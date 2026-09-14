import { EstadoPublicacion, TipoPublicacion } from "@prisma/client";
import type { MetaPublishClient, ResultadoPublicacion, StorageClient, TipoMedia } from "./types";
import { mensajeDeError } from "@/lib/mensaje-de-error";

const MAX_INTENTOS_PROCESAMIENTO = 30;
const INTERVALO_PROCESAMIENTO_MS = 5000;

export interface PublicarDesdeStorageInput {
  /** Mismo id usado como key en Storage al prepararla (ver preparar-archivo.ts) — hace falta para borrarlo. */
  driveFileId: string;
  tipoPublicacion: TipoPublicacion;
  tipoMedia: TipoMedia;
  storageUrl: string;
  caption?: string;
  cuenta: { igUserId: string; accessToken: string };
}

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
  try {
    const { containerId } = await clients.meta.createContainer(
      input.cuenta.igUserId,
      input.cuenta.accessToken,
      {
        tipoPublicacion: input.tipoPublicacion,
        media: { tipo: input.tipoMedia, url: input.storageUrl },
        caption: input.caption,
      }
    );

    if (input.tipoMedia === "video") {
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
    await clients.storage.borrar(input.driveFileId).catch(() => {});
  }
}
