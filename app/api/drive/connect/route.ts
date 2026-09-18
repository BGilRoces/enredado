import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { obtenerCuentaIdPermitida } from "@/lib/auth/cuenta-permitida";
import { buildAuthorizeUrl } from "@/lib/drive-oauth/oauth-url";
import { APP_URL, DRIVE_OAUTH_STATE_COOKIE } from "@/lib/drive-oauth/config";

// El acceso a Drive es un recurso global del panel, no por Cuenta de
// Instagram (ver ADR-0014) — sólo el dueño (sin restricción de Colaborador)
// puede conectarlo o reconectarlo.
export async function GET() {
  const cuentaIdPermitida = await obtenerCuentaIdPermitida();
  if (cuentaIdPermitida) {
    return NextResponse.redirect(new URL("/configuracion?error=No+ten%C3%A9s+acceso", APP_URL));
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = new URL("/api/drive/callback", APP_URL).toString();

  const response = NextResponse.redirect(buildAuthorizeUrl(redirectUri, state));
  response.cookies.set(DRIVE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });
  return response;
}
