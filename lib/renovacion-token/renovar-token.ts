import type { MetaClient } from "@/lib/meta/resolve-accounts";
import { mensajeDeError } from "@/lib/mensaje-de-error";

export type ResultadoRenovacion =
  | { ok: true; accessToken: string; tokenExpiraEl: Date }
  | { ok: false; error: string };

/**
 * Le pide a Meta que extienda el long-lived token actual — endpoint y grant
 * distintos del que se usa al conectar la Cuenta la primera vez (ver
 * ADR-0012 y lib/meta/resolve-accounts.ts): acá no son intercambiables, este
 * sólo funciona sobre un token ya emitido y de al menos 24hs.
 */
export async function renovarToken(
  accessTokenActual: string,
  metaClient: Pick<MetaClient, "refreshLongLivedToken">
): Promise<ResultadoRenovacion> {
  try {
    const { accessToken, expiresInSeconds } = await metaClient.refreshLongLivedToken(accessTokenActual);
    return {
      ok: true,
      accessToken,
      tokenExpiraEl: new Date(Date.now() + expiresInSeconds * 1000),
    };
  } catch (error) {
    return { ok: false, error: mensajeDeError(error) };
  }
}
