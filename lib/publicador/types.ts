import { EstadoPublicacion, TipoPublicacion } from "@prisma/client";

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

export type TipoMedia = "imagen" | "video";

export type MediaContenedor =
  | { tipo: "imagen"; url: string }
  | { tipo: "video"; url: string };

export interface CrearContenedorInput {
  tipoPublicacion: TipoPublicacion;
  media: MediaContenedor;
  caption?: string;
}

/**
 * Estado de procesamiento del contenedor en la Graph API. Las imágenes
 * quedan "listo" casi de inmediato; los videos/Reels tardan y hay que
 * esperarlos (ver lib/publicador/publicar.ts).
 */
export type EstadoContenedor = "en_progreso" | "listo" | "error";

export interface MetaPublishClient {
  createContainer(
    igUserId: string,
    accessToken: string,
    input: CrearContenedorInput
  ): Promise<{ containerId: string }>;
  getContainerStatus(
    igUserId: string,
    accessToken: string,
    containerId: string
  ): Promise<EstadoContenedor>;
  publishContainer(
    igUserId: string,
    accessToken: string,
    containerId: string
  ): Promise<{ mediaId: string }>;
}

export type ResultadoPublicacion =
  | { estado: typeof EstadoPublicacion.publicada; metaMediaId: string }
  | { estado: typeof EstadoPublicacion.fallida; error: string };
