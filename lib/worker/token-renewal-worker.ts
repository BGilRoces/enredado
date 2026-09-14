import { EstadoCuenta, type Cuenta } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { decryptToken, encryptToken } from "@/lib/crypto/token-cipher";
import { necesitaRenovacion } from "@/lib/renovacion-token/necesita-renovacion";
import { renovarToken } from "@/lib/renovacion-token/renovar-token";
import { metaClient } from "@/lib/meta/client";

/** Los long-lived tokens de Meta duran ~60 días — renovar con una semana de margen sobra. */
const MARGEN_RENOVACION_MS = 7 * 24 * 60 * 60 * 1000;
/** No hace falta más frecuencia que esta para un margen de una semana. */
const TICK_INTERVAL_MS = 12 * 60 * 60 * 1000;

let corriendo = false;

/**
 * Renueva el token de una Cuenta. Si Meta lo rechaza, la marca
 * `necesitaReconexion` en vez de dejarla "conectada" con un token que en la
 * próxima publicación real va a fallar sin explicación (ver ADR-0010).
 */
async function renovarCuenta(cuenta: Cuenta): Promise<void> {
  if (!cuenta.accessTokenEncriptado) return;

  const resultado = await renovarToken(decryptToken(cuenta.accessTokenEncriptado), metaClient);

  if (resultado.ok) {
    await prisma.cuenta.update({
      where: { id: cuenta.id },
      data: {
        accessTokenEncriptado: encryptToken(resultado.accessToken),
        tokenExpiraEl: resultado.tokenExpiraEl,
      },
    });
  } else {
    await prisma.cuenta.update({
      where: { id: cuenta.id },
      data: { estado: EstadoCuenta.necesitaReconexion },
    });
  }
}

/**
 * Revisa todas las Cuentas conectadas y renueva las que están por vencer.
 * Reentrante-seguro: si ya hay un tick corriendo, un llamado concurrente no
 * hace nada — el próximo intervalo la alcanza (mismo patrón que
 * lib/worker/publicador-worker.ts).
 */
export async function tick(): Promise<void> {
  if (corriendo) return;
  corriendo = true;
  try {
    const cuentas = await prisma.cuenta.findMany({
      where: { estado: EstadoCuenta.conectada, accessTokenEncriptado: { not: null } },
    });

    const ahora = new Date();
    for (const cuenta of cuentas) {
      if (!necesitaRenovacion(ahora, cuenta.tokenExpiraEl, MARGEN_RENOVACION_MS)) continue;
      await renovarCuenta(cuenta);
    }
  } finally {
    corriendo = false;
  }
}

const globalForRenewal = globalThis as unknown as { tokenRenewalWorkerStarted?: boolean };

/** Arranca el intervalo una sola vez por proceso — ver instrumentation.ts. */
export function startTokenRenewalWorker(): void {
  if (globalForRenewal.tokenRenewalWorkerStarted) return;
  globalForRenewal.tokenRenewalWorkerStarted = true;
  setInterval(() => {
    tick().catch((error) => {
      console.error("[token-renewal-worker] tick falló:", error);
    });
  }, TICK_INTERVAL_MS);
}
