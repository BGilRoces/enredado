"use server";

import { TipoPublicacion } from "@prisma/client";
import { mintDriveAccessToken } from "@/lib/drive-oauth/mint-access-token";
import { listarArchivosDeCarpeta } from "@/lib/drive/listar-carpeta";
import { obtenerArchivoDeDrive } from "@/lib/drive/obtener-archivo";
import { parsearDriveFolderId, parsearDriveLink } from "@/lib/ideas/parsear-drive-file-id";
import { esFormatoMediaSoportado } from "@/lib/publicador/preparar-archivo";

export interface ArchivoDeLink {
  id: string;
  nombre: string;
  mimeType: string;
  resourceKey?: string;
}

/**
 * Resuelve un link de Drive pegado a mano (archivo o carpeta) a la lista de
 * archivos a publicar, con la conexión de Drive guardada en Configuración
 * (mismo criterio que marcarEnDrive en ideas). Una carpeta lista su primer
 * nivel y se queda con lo que Instagram acepta; un Reel es un solo video, así
 * que no admite carpeta.
 */
export async function resolverLinkDrive(
  link: string,
  tipoPublicacion: TipoPublicacion
): Promise<ArchivoDeLink[]> {
  const archivo = parsearDriveLink(link);
  const folderId = archivo ? null : parsearDriveFolderId(link);
  if (!archivo && !folderId) {
    throw new Error('Ese link no parece ser de un archivo ni de una carpeta de Google Drive (probá con el de "Compartir").');
  }
  if (folderId && tipoPublicacion === TipoPublicacion.reel) {
    throw new Error("Un Reel es un solo video — pegá el link del archivo puntual, no el de una carpeta.");
  }

  const accessToken = await mintDriveAccessToken();

  if (archivo) {
    return [await obtenerArchivoDeDrive(archivo.driveFileId, accessToken, archivo.resourceKey)];
  }

  const soportados = (await listarArchivosDeCarpeta(folderId!, accessToken)).filter((a) =>
    esFormatoMediaSoportado(a.mimeType)
  );
  if (soportados.length === 0) {
    throw new Error("Esa carpeta no tiene fotos ni videos en un formato que Instagram acepte.");
  }
  return soportados;
}
