import { TipoPublicacion } from "@prisma/client";
import { prepararArchivo } from "./preparar-archivo";
import type { DriveClient, PrepararResultado, StorageClient, TipoMedia } from "./types";

export interface PublicacionAPrepararLazy {
  id: string;
  tipo: TipoPublicacion;
  idea: { driveFileId: string | null; driveResourceKey: string | null } | null;
}

export interface PrepararSiHaceFaltaClients {
  mintDriveAccessToken: () => Promise<string>;
  drive: DriveClient;
  storage: StorageClient;
}

/**
 * Prepara (baja de Drive, sube a Storage) una Publicación que vino de una
 * Idea promocionada y todavía no tiene `storageUrl`/`tipoMedia` — ver
 * ADR-0015. A diferencia del camino de /publicar (ADR-0009, token del Picker,
 * preparado siempre al crear), acá el token de Drive se mintea recién ahora,
 * con el refresh token guardado del lado del servidor (ver ADR-0014), así
 * que no importa cuánto tiempo pasó desde que se calendarizó la Idea.
 *
 * Extraída de `procesarUna` como su propia función inyectada específicamente
 * para poder testearla con fakes, igual que ya hace `preparar-archivo.test.ts`
 * para `prepararArchivo` — es la única lógica de orquestación genuinamente
 * nueva que suma este feature al pipeline de publicación.
 */
export async function prepararSiHaceFalta(
  publicacion: PublicacionAPrepararLazy,
  clients: PrepararSiHaceFaltaClients
): Promise<PrepararResultado> {
  if (!publicacion.idea?.driveFileId) {
    return { ok: false, error: "Falta el archivo de Drive de la Idea (bug interno)." };
  }

  let driveAccessToken: string;
  try {
    driveAccessToken = await clients.mintDriveAccessToken();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }

  const preparado = await prepararArchivo(
    {
      driveFileId: publicacion.idea.driveFileId,
      resourceKey: publicacion.idea.driveResourceKey ?? undefined,
      driveAccessToken,
      tipoPublicacion: publicacion.tipo,
    },
    { drive: clients.drive, storage: clients.storage }
  );

  return preparado;
}

export type { TipoMedia };
