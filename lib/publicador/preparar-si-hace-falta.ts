import { TipoPublicacion } from "@prisma/client";
import { prepararArchivo, prepararArchivos } from "./preparar-archivo";
import { mensajeDeError } from "@/lib/mensaje-de-error";
import type {
  DriveClient,
  PrepararArchivosResultado,
  PrepararResultado,
  StorageClient,
  TipoMedia,
} from "./types";

export interface PublicacionAPrepararLazy {
  tipo: TipoPublicacion;
  driveFileId: string | null;
  driveResourceKey: string | null;
  // Un carousel (ver ADR-0011) trae sus archivos acá, ya ordenados —
  // sólo aplica al caso "Post + carpeta" (ADR-0016).
  archivos: { id: string; driveFileId: string; driveResourceKey: string | null }[];
}

export interface PrepararSiHaceFaltaClients {
  mintDriveAccessToken: () => Promise<string>;
  drive: DriveClient;
  storage: StorageClient;
}

/**
 * Prepara (baja de Drive, sube a Storage) una Publicación que vino de una
 * Idea promocionada y todavía no tiene su archivo (o alguno de sus archivos,
 * si es un carousel) preparado — ver ADR-0015/0016. A diferencia del camino
 * de /publicar (ADR-0009, token del Picker, preparado siempre al crear), acá
 * el token de Drive se mintea recién ahora, con el refresh token guardado
 * del lado del servidor (ver ADR-0014), así que no importa cuánto tiempo
 * pasó desde que se calendarizó la Idea.
 *
 * Agnóstica de que la Publicación venga de una Idea: sólo mira sus propios
 * `driveFileId`/`driveResourceKey`/`archivos`, ya copiados ahí al promocionar
 * (`lib/ideas/promover-idea.ts`) — el llamador (`procesarUna`) es quien decide
 * CUÁNDO llamarla, mirando la relación `idea`.
 *
 * Extraída de `procesarUna` como su propia función inyectada específicamente
 * para poder testearla con fakes, igual que ya hace `preparar-archivo.test.ts`
 * para `prepararArchivo` — es la única lógica de orquestación genuinamente
 * nueva que suma este feature al pipeline de publicación.
 */
export async function prepararSiHaceFalta(
  publicacion: PublicacionAPrepararLazy,
  clients: PrepararSiHaceFaltaClients
): Promise<PrepararResultado | PrepararArchivosResultado> {
  let driveAccessToken: string;
  try {
    driveAccessToken = await clients.mintDriveAccessToken();
  } catch (error) {
    return { ok: false, error: mensajeDeError(error) };
  }

  if (publicacion.archivos.length > 0) {
    return prepararArchivos(
      {
        archivos: publicacion.archivos.map((a) => ({
          driveFileId: a.driveFileId,
          resourceKey: a.driveResourceKey ?? undefined,
        })),
        driveAccessToken,
        tipoPublicacion: publicacion.tipo,
      },
      { drive: clients.drive, storage: clients.storage }
    );
  }

  if (!publicacion.driveFileId) {
    return { ok: false, error: "Falta el archivo de Drive (bug interno)." };
  }

  return prepararArchivo(
    {
      driveFileId: publicacion.driveFileId,
      resourceKey: publicacion.driveResourceKey ?? undefined,
      driveAccessToken,
      tipoPublicacion: publicacion.tipo,
    },
    { drive: clients.drive, storage: clients.storage }
  );
}

export type { TipoMedia };
