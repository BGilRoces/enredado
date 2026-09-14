import sharp from "sharp";
import { TipoPublicacion } from "@prisma/client";
import type {
  DriveClient,
  PrepararArchivosResultado,
  PrepararResultado,
  StorageClient,
  TipoMedia,
} from "./types";
import { mensajeDeError } from "@/lib/mensaje-de-error";

/** Instagram solo acepta JPEG para imágenes (PNG/WebP/GIF son rechazados). */
const FORMATOS_IMAGEN_SOPORTADOS = new Set(["image/jpeg"]);
/** Los que deja elegir el Picker (ver use-google-picker.ts) y no son JPEG — se convierten en vez de rechazarse. */
const FORMATOS_IMAGEN_CONVERTIBLES = new Set(["image/png", "image/webp", "image/gif"]);
/** Contenedores de video que acepta la Graph API. */
const FORMATOS_VIDEO_SOPORTADOS = new Set(["video/mp4", "video/quicktime"]);

/**
 * Instagram sólo acepta JPEG para fotos — en vez de rechazar directo lo que
 * el usuario eligió de Drive en otro formato de imagen, se convierte acá
 * (fondo blanco para la transparencia de PNG/WebP; de un GIF animado queda
 * el primer cuadro, ya que Instagram tampoco soporta GIF animado como foto).
 */
async function convertirAJpegSiHaceFalta(
  data: Buffer,
  mimeType: string
): Promise<{ data: Buffer; mimeType: string }> {
  if (!FORMATOS_IMAGEN_CONVERTIBLES.has(mimeType)) return { data, mimeType };
  const convertido = await sharp(data).flatten({ background: "#ffffff" }).jpeg().toBuffer();
  return { data: convertido, mimeType: "image/jpeg" };
}

export interface PrepararArchivoInput {
  driveFileId: string;
  /** Token de Google (OAuth del Picker, scope drive.file) — no es el de Meta. */
  driveAccessToken: string;
  tipoPublicacion: TipoPublicacion;
  /** Ver DriveClient en types.ts — Drive lo exige para archivos compartidos por link. */
  resourceKey?: string;
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
    archivo = await clients.drive.descargarArchivo(input.driveFileId, input.driveAccessToken, input.resourceKey);
  } catch (error) {
    return { ok: false, error: mensajeDeError(error) };
  }

  try {
    archivo = await convertirAJpegSiHaceFalta(archivo.data, archivo.mimeType);
  } catch (error) {
    return { ok: false, error: `No se pudo convertir la imagen a JPEG: ${mensajeDeError(error)}` };
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

export interface PrepararArchivosInput {
  archivos: { driveFileId: string; resourceKey?: string }[];
  driveAccessToken: string;
  tipoPublicacion: TipoPublicacion;
}

/**
 * Igual que `prepararArchivo`, pero para varios archivos a la vez (carousel,
 * ver ADR-0011). Si alguno falla, borra (best-effort) los que ya se subieron
 * a Storage antes de devolver el error — no deja temporales huérfanos de una
 * Publicación que nunca se va a crear.
 */
export async function prepararArchivos(
  input: PrepararArchivosInput,
  clients: PrepararArchivoClients
): Promise<PrepararArchivosResultado> {
  const listos: { driveFileId: string; tipoMedia: TipoMedia; storageUrl: string }[] = [];

  for (const archivo of input.archivos) {
    const resultado = await prepararArchivo(
      {
        driveFileId: archivo.driveFileId,
        resourceKey: archivo.resourceKey,
        driveAccessToken: input.driveAccessToken,
        tipoPublicacion: input.tipoPublicacion,
      },
      clients
    );
    if (!resultado.ok) {
      await Promise.all(listos.map((l) => clients.storage.borrar(l.driveFileId).catch(() => {})));
      return { ok: false, error: resultado.error };
    }
    listos.push({ driveFileId: archivo.driveFileId, tipoMedia: resultado.tipoMedia, storageUrl: resultado.storageUrl });
  }

  return { ok: true, archivos: listos };
}
