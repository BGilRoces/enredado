import type { MetaClient } from "@/lib/meta/resolve-accounts";
import { mensajeDeError } from "@/lib/mensaje-de-error";

export type ResultadoRenovacion =
  | { ok: true; accessToken: string; tokenExpiraEl: Date }
  | { ok: false; error: string };

/**
 * Le pide a Meta un token nuevo a partir del actual — el mismo endpoint que
 * ya se usa al conectar la Cuenta (ver lib/meta/resolve-accounts.ts), que
 * también sirve para extender un long-lived token antes de que venza.
 */
export async function renovarToken(
  accessTokenActual: string,
  metaClient: Pick<MetaClient, "getLongLivedToken">
): Promise<ResultadoRenovacion> {
  try {
    const { accessToken, expiresInSeconds } = await metaClient.getLongLivedToken(accessTokenActual);
    return {
      ok: true,
      accessToken,
      tokenExpiraEl: new Date(Date.now() + expiresInSeconds * 1000),
    };
  } catch (error) {
    return { ok: false, error: mensajeDeError(error) };
  }
}
