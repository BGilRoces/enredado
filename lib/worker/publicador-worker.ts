import { EstadoCuenta, EstadoPublicacion } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { decryptToken } from "@/lib/crypto/token-cipher";
import { decidirVencidas } from "@/lib/scheduler/decidir-vencidas";
import { decidirSiguiente } from "@/lib/cola/decidir-siguiente";
import { publicarDesdeStorage } from "@/lib/publicador/publicar-desde-storage";
import { esperarMs } from "@/lib/publicador/esperar";
import { storageClient } from "@/lib/storage/client";
import { metaPublishClient } from "@/lib/meta/client";

/** ADR-0004: no hace falta más frecuencia — el "ahora" no espera al intervalo, ver tick() abajo. */
const TICK_INTERVAL_MS = 2 * 60 * 1000;

let corriendo = false;

/**
 * Procesa una Publicación por id. El paso a "publicando" es un `updateMany`
 * guardado por `estado: pendiente` (no un `update` por id a secas): entre el
 * momento en que `tick()` la vio pendiente y este punto puede haberse
 * cancelado o editado — si ya no está pendiente, no hay nada que hacer. Por
 * la misma razón se relee la fila recién después de ganar la carrera, en vez
 * de reusar los datos del snapshot que armó `tick()`.
 */
async function procesarUna(id: string): Promise<void> {
  const { count } = await prisma.publicacion.updateMany({
    where: { id, estado: EstadoPublicacion.pendiente },
    data: { estado: EstadoPublicacion.publicando },
  });
  if (count === 0) return;

  const publicacion = await prisma.publicacion.findUniqueOrThrow({
    where: { id },
    include: { cuenta: true },
  });

  if (!publicacion.cuenta.accessTokenEncriptado || publicacion.cuenta.estado !== EstadoCuenta.conectada) {
    await prisma.publicacion.update({
      where: { id: publicacion.id },
      data: { estado: EstadoPublicacion.fallida, error: "La Cuenta ya no está conectada." },
    });
    return;
  }
  if (!publicacion.storageUrl || !publicacion.tipoMedia) {
    await prisma.publicacion.update({
      where: { id: publicacion.id },
      data: { estado: EstadoPublicacion.fallida, error: "Falta el archivo preparado (bug interno)." },
    });
    return;
  }

  const resultado = await publicarDesdeStorage(
    {
      driveFileId: publicacion.driveFileId,
      tipoPublicacion: publicacion.tipo,
      tipoMedia: publicacion.tipoMedia,
      storageUrl: publicacion.storageUrl,
      caption: publicacion.caption ?? undefined,
      cuenta: {
        igUserId: publicacion.cuenta.igUserId,
        accessToken: decryptToken(publicacion.cuenta.accessTokenEncriptado),
      },
    },
    { meta: metaPublishClient, storage: storageClient, esperar: esperarMs }
  );

  await prisma.publicacion.update({
    where: { id: publicacion.id },
    data:
      resultado.estado === EstadoPublicacion.publicada
        ? { estado: EstadoPublicacion.publicada, metaMediaId: resultado.metaMediaId }
        : { estado: EstadoPublicacion.fallida, error: resultado.error },
  });
}

/**
 * Procesa, de a una, todas las Publicaciones "pendiente" que ya vencieron
 * (ADR-0004/0005). Reentrante-seguro: si ya hay un tick corriendo, un
 * llamado concurrente no hace nada — el intervalo o el próximo trigger la
 * van a alcanzar.
 */
export async function tick(): Promise<void> {
  if (corriendo) return;
  corriendo = true;
  try {
    for (;;) {
      const enCurso = await prisma.publicacion.count({
        where: { estado: EstadoPublicacion.publicando },
      });

      const candidatas = await prisma.publicacion.findMany({
        where: { estado: EstadoPublicacion.pendiente },
        orderBy: [{ creadaEn: "asc" }, { id: "asc" }],
        select: { id: true, programadaPara: true },
      });

      const vencidas = decidirVencidas(new Date(), candidatas);
      const siguienteId = decidirSiguiente(enCurso > 0, vencidas);
      if (!siguienteId) return;

      await procesarUna(siguienteId);
    }
  } finally {
    corriendo = false;
  }
}

const globalForWorker = globalThis as unknown as { publicadorWorkerStarted?: boolean };

/** Arranca el intervalo una sola vez por proceso — ver instrumentation.ts. */
export function startPublicadorWorker(): void {
  if (globalForWorker.publicadorWorkerStarted) return;
  globalForWorker.publicadorWorkerStarted = true;
  setInterval(() => {
    tick().catch((error) => {
      console.error("[publicador-worker] tick falló:", error);
    });
  }, TICK_INTERVAL_MS);
}
