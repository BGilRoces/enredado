import { NextResponse, type NextRequest } from "next/server";
import { EstadoCuenta, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { encryptToken } from "@/lib/crypto/token-cipher";
import { metaClient } from "@/lib/meta/client";
import { resolveInstagramAccounts, type ResolvedAccount } from "@/lib/meta/resolve-accounts";
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
    pageId: cuenta.pageId,
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

  let resolved: ResolvedAccount[];
  try {
    resolved = await resolveInstagramAccounts(outcome.code, redirectUri, metaClient);
  } catch {
    return redirectToCuentas({
      error: "Meta rechazó la conexión. Revisá que la cuenta sea Business/Creator y esté vinculada a una Página de Facebook.",
    });
  }

  if (resolved.length === 0) {
    return redirectToCuentas({
      error: "No encontramos ninguna Cuenta de Instagram Business/Creator vinculada a tus Páginas de Facebook.",
    });
  }

  try {
    await prisma.$transaction(
      resolved.map((cuenta) => {
        const data = cuentaData(cuenta);
        return prisma.cuenta.upsert({
          where: { igUserId: cuenta.igUserId },
          create: data,
          update: data,
        });
      })
    );
  } catch {
    return redirectToCuentas({
      error: "Conectamos con Meta pero no pudimos guardar la(s) Cuenta(s). Probá de nuevo.",
    });
  }

  return redirectToCuentas({ connected: String(resolved.length) });
}
