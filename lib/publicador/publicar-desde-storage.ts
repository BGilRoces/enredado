import { EstadoPublicacion, TipoPublicacion } from "@prisma/client";
import type { MetaPublishClient, ResultadoPublicacion, StorageClient, TipoMedia } from "./types";
import { mensajeDeError } from "@/lib/mensaje-de-error";

const MAX_INTENTOS_PROCESAMIENTO = 30;
const INTERVALO_PROCESAMIENTO_MS = 5000;

interface PublicarDesdeStorageInputComun {
  caption?: string;
  cuenta: { igUserId: string; accessToken: string };
}

export interface PublicarDesdeStorageInputSimple extends PublicarDesdeStorageInputComun {
  modo: "single";
  /** Mismo id usado como key en Storage al prepararla (ver preparar-archivo.ts) — hace falta para borrarlo. */
  driveFileId: string;
  tipoPublicacion: TipoPublicacion;
  tipoMedia: TipoMedia;
  storageUrl: string;
}

/** Post con 2-10 archivos (ver ADR-0011) — Historia/Reel nunca llegan acá, la Graph API no tiene carousel para esos tipos. */
export interface PublicarDesdeStorageInputCarousel extends PublicarDesdeStorageInputComun {
  modo: "carousel";
  archivos: { driveFileId: string; tipoMedia: TipoMedia; storageUrl: string }[];
}

export type PublicarDesdeStorageInput = PublicarDesdeStorageInputSimple | PublicarDesdeStorageInputCarousel;

export interface PublicarDesdeStorageClients {
  meta: MetaPublishClient;
  storage: StorageClient;
  /** Espera entre polls de procesamiento — inyectable para no esperar de verdad en tests. */
  esperar: (ms: number) => Promise<void>;
}

function fallida(error: unknown): ResultadoPublicacion {
  return { estado: EstadoPublicacion.fallida, error: mensajeDeError(error) };
}

async function esperarProcesamiento(
  meta: MetaPublishClient,
  igUserId: string,
  accessToken: string,
  containerId: string,
  esperar: (ms: number) => Promise<void>
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (let intento = 0; intento < MAX_INTENTOS_PROCESAMIENTO; intento++) {
    const estado = await meta.getContainerStatus(igUserId, accessToken, containerId);
    if (estado === "listo") return { ok: true };
    if (estado === "error") {
      return {
        ok: false,
        error: "Meta no pudo procesar el archivo (formato, duración o especificaciones no soportadas).",
      };
    }
    if (intento < MAX_INTENTOS_PROCESAMIENTO - 1) {
      await esperar(INTERVALO_PROCESAMIENTO_MS);
    }
  }
  return { ok: false, error: "Meta tardó demasiado en procesar el archivo. Probá de nuevo más tarde." };
}

/**
 * Segundo paso del Publicador (ver ADR-0009): el archivo ya está expuesto en
 * Storage (lo dejó `prepararArchivo` al crear la Publicación) — acá solo se
 * habla con Meta: crea el contenedor, espera el procesamiento si es video, y
 * publica. El temporal de Storage se borra siempre al terminar, haya salido
 * bien o mal.
 */
export async function publicarDesdeStorage(
  input: PublicarDesdeStorageInput,
  clients: PublicarDesdeStorageClients
): Promise<ResultadoPublicacion> {
  const driveFileIds = input.modo === "single" ? [input.driveFileId] : input.archivos.map((a) => a.driveFileId);

  try {
    const { containerId, hayVideo } =
      input.modo === "single"
        ? {
            ...(await clients.meta.createContainer(input.cuenta.igUserId, input.cuenta.accessToken, {
              tipoPublicacion: input.tipoPublicacion,
              media: { tipo: input.tipoMedia, url: input.storageUrl },
              caption: input.caption,
            })),
            hayVideo: input.tipoMedia === "video",
          }
        : {
            ...(await clients.meta.createCarouselContainer(input.cuenta.igUserId, input.cuenta.accessToken, {
              items: input.archivos.map((a) => ({ tipo: a.tipoMedia, url: a.storageUrl })),
              caption: input.caption,
            })),
            hayVideo: input.archivos.some((a) => a.tipoMedia === "video"),
          };

    if (hayVideo) {
      const procesado = await esperarProcesamiento(
        clients.meta,
        input.cuenta.igUserId,
        input.cuenta.accessToken,
        containerId,
        clients.esperar
      );
      if (!procesado.ok) {
        return { estado: EstadoPublicacion.fallida, error: procesado.error };
      }
    }

    const { mediaId } = await clients.meta.publishContainer(
      input.cuenta.igUserId,
      input.cuenta.accessToken,
      containerId
    );
    return { estado: EstadoPublicacion.publicada, metaMediaId: mediaId };
  } catch (error) {
    return fallida(error);
  } finally {
    // Limpieza best-effort: si falla, no debe tapar el resultado ya decidido arriba.
    await Promise.all(driveFileIds.map((id) => clients.storage.borrar(id).catch(() => {})));
  }
}
