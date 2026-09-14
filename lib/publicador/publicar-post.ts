import { EstadoPublicacion } from "@prisma/client";
import type { DriveClient, MetaPublishClient, ResultadoPublicacion, StorageClient } from "./types";

/** Instagram solo acepta JPEG para Posts de imagen (PNG/WebP/GIF son rechazados). */
const FORMATOS_IMAGEN_SOPORTADOS = new Set(["image/jpeg"]);

export interface PublicarPostInput {
  driveFileId: string;
  /** Token de Google (OAuth del Picker, scope drive.file) — no es el de Meta. */
  driveAccessToken: string;
  caption?: string;
  cuenta: { igUserId: string; accessToken: string };
}

export interface PublicarPostClients {
  drive: DriveClient;
  storage: StorageClient;
  meta: MetaPublishClient;
}

function fallida(error: unknown): ResultadoPublicacion {
  return { estado: EstadoPublicacion.fallida, error: error instanceof Error ? error.message : String(error) };
}

/**
 * Camino feliz de un Post de imagen: baja el archivo de Drive, lo expone
 * temporalmente en Storage, crea el contenedor de media en la Graph API y lo
 * publica. Ninguna etapa (Drive, Storage, Meta) puede tirar sin convertirse
 * en un resultado "fallida": el llamador persiste ese resultado en la
 * Publicación, así que un throw sin capturar la dejaría trabada en
 * "publicando" para siempre.
 */
export async function publicarPost(
  input: PublicarPostInput,
  clients: PublicarPostClients
): Promise<ResultadoPublicacion> {
  let archivo;
  try {
    archivo = await clients.drive.descargarArchivo(input.driveFileId, input.driveAccessToken);
  } catch (error) {
    return fallida(error);
  }

  if (!FORMATOS_IMAGEN_SOPORTADOS.has(archivo.mimeType)) {
    return {
      estado: EstadoPublicacion.fallida,
      error: `Formato no soportado por Instagram (${archivo.mimeType}). Los Posts de imagen requieren JPEG.`,
    };
  }

  let subido = false;
  try {
    const { url } = await clients.storage.subir(input.driveFileId, archivo.data, archivo.mimeType);
    subido = true;

    const { containerId } = await clients.meta.createImageContainer(
      input.cuenta.igUserId,
      input.cuenta.accessToken,
      { imageUrl: url, caption: input.caption }
    );
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
