import {
  EstadoCuenta,
  EstadoPublicacion,
  type Cuenta,
  type Publicacion,
  type PublicacionArchivo,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { decryptToken } from "@/lib/crypto/token-cipher";
import { decidirVencidas } from "@/lib/scheduler/decidir-vencidas";
import { decidirSiguiente } from "@/lib/cola/decidir-siguiente";
import { excedioLimiteDiario, LIMITE_PUBLICACIONES_POR_VENTANA } from "@/lib/limite-diario/excedio-limite-diario";
import { publicarDesdeStorage } from "@/lib/publicador/publicar-desde-storage";
import { prepararSiHaceFalta } from "@/lib/publicador/preparar-si-hace-falta";
import { esperarMs } from "@/lib/publicador/esperar";
import { storageClient } from "@/lib/storage/client";
import { metaPublishClient } from "@/lib/meta/client";
import { driveClient } from "@/lib/drive/client";
import { mintDriveAccessToken } from "@/lib/drive-oauth/mint-access-token";

/** ADR-0004: no hace falta más frecuencia — el "ahora" no espera al intervalo, ver tick() abajo. */
const TICK_INTERVAL_MS = 2 * 60 * 1000;
/** Margen de sobra sobre el límite real de Meta, para no cortar la ventana móvil de raíz. */
const CANDIDATAS_PARA_LIMITE = LIMITE_PUBLICACIONES_POR_VENTANA * 4;

let corriendo = false;

/** Ver ADR implícito del ticket 08: la Cuenta ya llegó a su límite diario de Meta (ventana móvil de 24hs). */
async function superaLimiteDiario(cuentaId: string): Promise<boolean> {
  const publicadasRecientes = await prisma.publicacion.findMany({
    where: { cuentaId, estado: EstadoPublicacion.publicada, publicadaEn: { not: null } },
    orderBy: { publicadaEn: "desc" },
    take: CANDIDATAS_PARA_LIMITE,
    select: { publicadaEn: true },
  });
  return excedioLimiteDiario(
    new Date(),
    publicadasRecientes.map((p) => p.publicadaEn as Date)
  );
}

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

  let publicacion = await prisma.publicacion.findUniqueOrThrow({
    where: { id },
    include: { cuenta: true, archivos: { orderBy: { orden: "asc" } }, idea: true },
  });

  if (!publicacion.cuenta.accessTokenEncriptado || publicacion.cuenta.estado !== EstadoCuenta.conectada) {
    await prisma.publicacion.update({
      where: { id: publicacion.id },
      data: { estado: EstadoPublicacion.fallida, error: "La Cuenta ya no está conectada." },
    });
    return;
  }
  // Un carousel (ver ADR-0011) trae sus archivos en `archivos`, no en los
  // campos sueltos de la fila padre.
  const esCarousel = publicacion.archivos.length > 0;
  const faltaSimple = !esCarousel && (!publicacion.storageUrl || !publicacion.tipoMedia);
  const faltaCarousel = esCarousel && publicacion.archivos.some((a) => !a.storageUrl || !a.tipoMedia);

  if ((faltaSimple || faltaCarousel) && publicacion.idea) {
    // Ver ADR-0015/0016: esta Publicación nació de una Idea promocionada — a
    // diferencia del camino de /publicar (ADR-0009/0011, ya preparado al
    // crear), acá se prepara recién ahora, con el token de Drive del servidor.
    const preparado = await prepararSiHaceFalta(publicacion, {
      mintDriveAccessToken,
      drive: driveClient,
      storage: storageClient,
    });
    if (!preparado.ok) {
      await prisma.publicacion.update({
        where: { id: publicacion.id },
        data: { estado: EstadoPublicacion.fallida, error: preparado.error },
      });
      return;
    }

    if ("archivos" in preparado) {
      // `preparado.archivos` viene en el mismo orden que se lo pasamos
      // (publicacion.archivos, ya ordenado por `orden` — ver preparar-si-hace-falta.ts).
      const resueltos = preparado.archivos;
      await prisma.$transaction(
        publicacion.archivos.map((a, i) =>
          prisma.publicacionArchivo.update({
            where: { id: a.id },
            data: { tipoMedia: resueltos[i].tipoMedia, storageUrl: resueltos[i].storageUrl },
          })
        )
      );
    } else {
      await prisma.publicacion.update({
        where: { id: publicacion.id },
        data: { storageUrl: preparado.storageUrl, tipoMedia: preparado.tipoMedia },
      });
    }

    publicacion = await prisma.publicacion.findUniqueOrThrow({
      where: { id: publicacion.id },
      include: { cuenta: true, archivos: { orderBy: { orden: "asc" } }, idea: true },
    });
  } else if (faltaSimple || faltaCarousel) {
    await prisma.publicacion.update({
      where: { id: publicacion.id },
      data: { estado: EstadoPublicacion.fallida, error: "Falta el archivo preparado (bug interno)." },
    });
    return;
  }
  if (await superaLimiteDiario(publicacion.cuentaId)) {
    await prisma.publicacion.update({
      where: { id: publicacion.id },
      data: {
        estado: EstadoPublicacion.bloqueadaPorLimite,
        error:
          "Se alcanzó el límite diario de publicaciones de Meta para esta Cuenta. Podés reintentar creando la Publicación de nuevo más tarde.",
      },
    });
    return;
  }

  await publicarUna(publicacion);
}

async function publicarUna(
  publicacion: Publicacion & { cuenta: Cuenta; archivos: PublicacionArchivo[] }
): Promise<void> {
  const cuenta = {
    igUserId: publicacion.cuenta.igUserId,
    accessToken: decryptToken(publicacion.cuenta.accessTokenEncriptado!),
  };

  // Los dos guards de arriba (Cuenta conectada, archivo(s) preparado(s)) ya lo garantizan acá.
  const resultado = await publicarDesdeStorage(
    publicacion.archivos.length > 0
      ? {
          modo: "carousel",
          archivos: publicacion.archivos.map((a) => ({
            driveFileId: a.driveFileId,
            tipoMedia: a.tipoMedia!,
            storageUrl: a.storageUrl!,
          })),
          caption: publicacion.caption ?? undefined,
          cuenta,
        }
      : {
          modo: "single",
          driveFileId: publicacion.driveFileId!,
          tipoPublicacion: publicacion.tipo,
          tipoMedia: publicacion.tipoMedia!,
          storageUrl: publicacion.storageUrl!,
          caption: publicacion.caption ?? undefined,
          cuenta,
        },
    { meta: metaPublishClient, storage: storageClient, esperar: esperarMs }
  );

  await prisma.publicacion.update({
    where: { id: publicacion.id },
    data:
      resultado.estado === EstadoPublicacion.publicada
        ? { estado: EstadoPublicacion.publicada, metaMediaId: resultado.metaMediaId, publicadaEn: new Date() }
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
