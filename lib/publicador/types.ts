import { EstadoPublicacion } from "@prisma/client";

export interface ArchivoDrive {
  data: Buffer;
  mimeType: string;
}

export interface DriveClient {
  descargarArchivo(driveFileId: string, accessToken: string): Promise<ArchivoDrive>;
}

export interface StorageClient {
  subir(nombre: string, data: Buffer, contentType: string): Promise<{ url: string }>;
  borrar(nombre: string): Promise<void>;
}

export interface MetaPublishClient {
  createImageContainer(
    igUserId: string,
    accessToken: string,
    params: { imageUrl: string; caption?: string }
  ): Promise<{ containerId: string }>;
  publishContainer(
    igUserId: string,
    accessToken: string,
    containerId: string
  ): Promise<{ mediaId: string }>;
}

export type ResultadoPublicacion =
  | { estado: typeof EstadoPublicacion.publicada; metaMediaId: string }
  | { estado: typeof EstadoPublicacion.fallida; error: string };
