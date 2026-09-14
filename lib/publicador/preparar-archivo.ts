import { TipoPublicacion } from "@prisma/client";
import type { DriveClient, PrepararResultado, StorageClient, TipoMedia } from "./types";
import { mensajeDeError } from "./mensaje-de-error";

/** Instagram solo acepta JPEG para imágenes (PNG/WebP/GIF son rechazados). */
const FORMATOS_IMAGEN_SOPORTADOS = new Set(["image/jpeg"]);
/** Contenedores de video que acepta la Graph API. */
const FORMATOS_VIDEO_SOPORTADOS = new Set(["video/mp4", "video/quicktime"]);

export interface PrepararArchivoInput {
  driveFileId: string;
  /** Token de Google (OAuth del Picker, scope drive.file) — no es el de Meta. */
  driveAccessToken: string;
  tipoPublicacion: TipoPublicacion;
}

export interface PrepararArchivoClients {
  drive: DriveClient;
  storage: StorageClient;
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
 * Baja el archivo de Drive con el token todavía fresco y lo expone en
 * Storage. Corre al crear la Publicación (inmediata o programada) — ver
 * ADR-0009: el token de Drive no sobrevive hasta el momento real de publicar,
 * así que ese paso no puede esperar a que la cola la dispare.
 */
export async function prepararArchivo(
  input: PrepararArchivoInput,
  clients: PrepararArchivoClients
): Promise<PrepararResultado> {
  let archivo;
  try {
    archivo = await clients.drive.descargarArchivo(input.driveFileId, input.driveAccessToken);
  } catch (error) {
    return { ok: false, error: mensajeDeError(error) };
  }

  const tipoMedia = detectarTipoMedia(input.tipoPublicacion, archivo.mimeType);
  if (!tipoMedia) {
    return {
      ok: false,
      error: `Formato no soportado por Instagram para ${input.tipoPublicacion} (${archivo.mimeType}).`,
    };
  }

  try {
    const { url } = await clients.storage.subir(input.driveFileId, archivo.data, archivo.mimeType);
    return { ok: true, tipoMedia, storageUrl: url };
  } catch (error) {
    return { ok: false, error: mensajeDeError(error) };
  }
}
