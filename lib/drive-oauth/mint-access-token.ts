import { prisma } from "@/lib/db/prisma";
import { decryptToken } from "@/lib/crypto/token-cipher";
import { requireEnv } from "@/lib/env";

const DRIVE_CREDENCIAL_SLOT = "default";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseGoogleResponse(res: Response, body: any) {
  if (!res.ok) {
    const motivo = body?.error_description ?? body?.error ?? `sin más detalle (HTTP ${res.status})`;
    throw new Error(`Google rechazó la solicitud: ${motivo}`);
  }
  return body;
}

/**
 * Mintea un access token de Drive fresco a partir del refresh token guardado
 * (ver ADR-0014) — se llama bajo demanda, cada vez que el worker necesita
 * bajar un archivo, nunca se cachea entre llamadas (a diferencia del token
 * de Meta, este no hace falta guardarlo: pedirlo de nuevo no cuesta más que
 * un round-trip HTTP, y así nunca queda un access token viejo dando vueltas).
 */
export async function mintDriveAccessToken(): Promise<string> {
  const credencial = await prisma.driveCredencial.findUnique({
    where: { slot: DRIVE_CREDENCIAL_SLOT },
  });
  if (!credencial) {
    throw new Error("Drive no está conectado — andá a Configuración y conectá tu cuenta de Google.");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: decryptToken(credencial.refreshTokenEncriptado),
    }),
  });
  const body = parseGoogleResponse(res, await res.json());
  return body.access_token as string;
}
