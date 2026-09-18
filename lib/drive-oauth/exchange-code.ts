import { requireEnv } from "@/lib/env";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseGoogleResponse(res: Response, body: any) {
  if (!res.ok) {
    const motivo = body?.error_description ?? body?.error ?? `sin más detalle (HTTP ${res.status})`;
    throw new Error(`Google rechazó la solicitud: ${motivo}`);
  }
  return body;
}

export interface CodigoIntercambiado {
  refreshToken: string;
  accessToken: string;
}

/**
 * Intercambia el `code` del callback por un refresh token (ver ADR-0014).
 * Google sólo lo manda si el pedido incluyó `access_type=offline` (ver
 * oauth-url.ts) — si Bautista ya había consentido antes y Google no le pide
 * el diálogo de nuevo, esto puede venir vacío; `prompt=consent` en la URL de
 * autorización está para evitar justo ese caso.
 */
export async function exchangeCodeForRefreshToken(
  code: string,
  redirectUri: string
): Promise<CodigoIntercambiado> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    }),
  });
  const body = parseGoogleResponse(res, await res.json());
  if (!body.refresh_token) {
    throw new Error(
      "Google no mandó un refresh token — probá desconectar el acceso en https://myaccount.google.com/permissions y conectar de nuevo."
    );
  }
  return { refreshToken: body.refresh_token as string, accessToken: body.access_token as string };
}

/** Sólo para mostrar "Conectado como x@gmail.com" en /configuracion — no se usa para nada más. */
export async function obtenerEmailDeCuenta(accessToken: string): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const body = await res.json();
  return body?.user?.emailAddress ?? null;
}
