import { NextResponse, type NextRequest } from "next/server";
import { EstadoCuenta, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { encryptToken } from "@/lib/crypto/token-cipher";
import { metaClient } from "@/lib/meta/client";
import { resolveInstagramAccount, type ResolvedAccount } from "@/lib/meta/resolve-accounts";
import { decideCallbackOutcome } from "@/lib/meta/callback-outcome";
import { APP_URL, OAUTH_STATE_COOKIE } from "@/lib/meta/config";

function redirectToCuentas(params: Record<string, string>) {
  const url = new URL("/cuentas", APP_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = NextResponse.redirect(url);
  response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
}

function cuentaData(cuenta: ResolvedAccount): Prisma.CuentaCreateInput {
  return {
    nombre: cuenta.nombre,
    igUserId: cuenta.igUserId,
    igUsername: cuenta.igUsername,
    accessTokenEncriptado: encryptToken(cuenta.accessToken),
    tokenExpiraEl: cuenta.tokenExpiraEl,
    estado: EstadoCuenta.conectada,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const outcome = decideCallbackOutcome({
    code: searchParams.get("code"),
    state: searchParams.get("state"),
    savedState: request.cookies.get(OAUTH_STATE_COOKIE)?.value,
    metaError: searchParams.get("error_description") ?? searchParams.get("error"),
  });

  if (outcome.type === "error") {
    return redirectToCuentas({ error: outcome.message });
  }

  const redirectUri = new URL("/api/meta/callback", APP_URL).toString();

  let resolved: ResolvedAccount;
  try {
    resolved = await resolveInstagramAccount(outcome.code, redirectUri, metaClient);
  } catch {
    return redirectToCuentas({
      error: "Meta rechazó la conexión. Revisá que la cuenta sea Business/Creator.",
    });
  }

  try {
    const data = cuentaData(resolved);
    await prisma.cuenta.upsert({
      where: { igUserId: resolved.igUserId },
      create: data,
      update: data,
    });
  } catch {
    return redirectToCuentas({
      error: "Conectamos con Meta pero no pudimos guardar la Cuenta. Probá de nuevo.",
    });
  }

  return redirectToCuentas({ connected: "1" });
}
