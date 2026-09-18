import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { encryptToken } from "@/lib/crypto/token-cipher";
import { obtenerCuentaIdPermitida } from "@/lib/auth/cuenta-permitida";
import { exchangeCodeForRefreshToken, obtenerEmailDeCuenta } from "@/lib/drive-oauth/exchange-code";
import { decideCallbackOutcome } from "@/lib/drive-oauth/callback-outcome";
import { APP_URL, DRIVE_OAUTH_STATE_COOKIE } from "@/lib/drive-oauth/config";
import { mensajeDeError } from "@/lib/mensaje-de-error";

const DRIVE_CREDENCIAL_SLOT = "default";

function redirectToConfiguracion(params: Record<string, string>) {
  const url = new URL("/configuracion", APP_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = NextResponse.redirect(url);
  response.cookies.delete(DRIVE_OAUTH_STATE_COOKIE);
  return response;
}

export async function GET(request: NextRequest) {
  // Mismo motivo que en /api/drive/connect: recurso global, sólo el dueño.
  const cuentaIdPermitida = await obtenerCuentaIdPermitida();
  if (cuentaIdPermitida) {
    return redirectToConfiguracion({ error: "No tenés acceso." });
  }

  const { searchParams } = request.nextUrl;

  const outcome = decideCallbackOutcome({
    code: searchParams.get("code"),
    state: searchParams.get("state"),
    savedState: request.cookies.get(DRIVE_OAUTH_STATE_COOKIE)?.value,
    googleError: searchParams.get("error"),
  });

  if (outcome.type === "error") {
    return redirectToConfiguracion({ error: outcome.message });
  }

  const redirectUri = new URL("/api/drive/callback", APP_URL).toString();

  try {
    const { refreshToken, accessToken } = await exchangeCodeForRefreshToken(outcome.code, redirectUri);
    const cuentaGoogleEmail = (await obtenerEmailDeCuenta(accessToken)) ?? "desconocida";

    await prisma.driveCredencial.upsert({
      where: { slot: DRIVE_CREDENCIAL_SLOT },
      create: {
        slot: DRIVE_CREDENCIAL_SLOT,
        cuentaGoogleEmail,
        refreshTokenEncriptado: encryptToken(refreshToken),
      },
      update: {
        cuentaGoogleEmail,
        refreshTokenEncriptado: encryptToken(refreshToken),
      },
    });
  } catch (error) {
    return redirectToConfiguracion({ error: mensajeDeError(error) });
  }

  return redirectToConfiguracion({ connected: "1" });
}
