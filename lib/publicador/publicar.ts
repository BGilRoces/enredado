import { EstadoPublicacion, TipoPublicacion } from "@prisma/client";
import type {
  DriveClient,
  MetaPublishClient,
  ResultadoPublicacion,
  StorageClient,
  TipoMedia,
} from "./types";

/** Instagram solo acepta JPEG para imágenes (PNG/WebP/GIF son rechazados). */
const FORMATOS_IMAGEN_SOPORTADOS = new Set(["image/jpeg"]);
/** Contenedores de video que acepta la Graph API. */
const FORMATOS_VIDEO_SOPORTADOS = new Set(["video/mp4", "video/quicktime"]);

const MAX_INTENTOS_PROCESAMIENTO = 30;
const INTERVALO_PROCESAMIENTO_MS = 5000;

export interface PublicarInput {
  driveFileId: string;
  /** Token de Google (OAuth del Picker, scope drive.file) — no es el de Meta. */
  driveAccessToken: string;
  tipoPublicacion: TipoPublicacion;
  caption?: string;
  cuenta: { igUserId: string; accessToken: string };
}

export interface PublicarClients {
  drive: DriveClient;
  storage: StorageClient;
  meta: MetaPublishClient;
  /** Espera entre polls de procesamiento — inyectable para no esperar de verdad en tests. */
  esperar: (ms: number) => Promise<void>;
}

function fallida(error: unknown): ResultadoPublicacion {
  return {
    estado: EstadoPublicacion.fallida,
    error: error instanceof Error ? error.message : String(error),
  };
}

/** Reel es siempre video; Post e Historia aceptan imagen o video. */
function detectarTipoMedia(
  tipoPublicacion: TipoPublicacion,
  mimeType: string
): TipoMedia | null {
  if (tipoPublicacion === TipoPublicacion.reel) {
    return FORMATOS_VIDEO_SOPORTADOS.has(mimeType) ? "video" : null;
  }
  if (FORMATOS_IMAGEN_SOPORTADOS.has(mimeType)) return "imagen";
  if (FORMATOS_VIDEO_SOPORTADOS.has(mimeType)) return "video";
  return null;
}

/**
 * Poll del estado del contenedor hasta que Meta termine de procesarlo. Solo
 * hace falta para video/Reel (spec.md, ADR implícito del ticket 04) — las
 * imágenes no se transcodifican, publicarlas de inmediato es el camino ya
 * verificado en el ticket 03 y no hay que tocarlo.
 */
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
 * Camino feliz de una Publicación (Post, Historia o Reel; imagen o video):
 * baja el archivo de Drive, lo expone temporalmente en Storage, crea el
 * contenedor de media en la Graph API, espera a que Meta termine de
 * procesarlo y recién ahí publica. Ninguna etapa puede tirar sin convertirse
 * en un resultado "fallida": el llamador persiste ese resultado en la
 * Publicación, así que un throw sin capturar la dejaría trabada en
 * "publicando" para siempre.
 */
export async function publicar(
  input: PublicarInput,
  clients: PublicarClients
): Promise<ResultadoPublicacion> {
  let archivo;
  try {
    archivo = await clients.drive.descargarArchivo(input.driveFileId, input.driveAccessToken);
  } catch (error) {
    return fallida(error);
  }

  const tipoMedia = detectarTipoMedia(input.tipoPublicacion, archivo.mimeType);
  if (!tipoMedia) {
    return {
      estado: EstadoPublicacion.fallida,
      error: `Formato no soportado por Instagram para ${input.tipoPublicacion} (${archivo.mimeType}).`,
    };
  }

  let subido = false;
  try {
    const { url } = await clients.storage.subir(input.driveFileId, archivo.data, archivo.mimeType);
    subido = true;

    const { containerId } = await clients.meta.createContainer(
      input.cuenta.igUserId,
      input.cuenta.accessToken,
      {
        tipoPublicacion: input.tipoPublicacion,
        media: { tipo: tipoMedia, url },
        caption: input.caption,
      }
    );

    if (tipoMedia === "video") {
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
    if (subido) {
      // Limpieza best-effort: si falla, no debe tapar el resultado ya decidido arriba.
      await clients.storage.borrar(input.driveFileId).catch(() => {});
    }
  }
}
