"use server";

import { revalidatePath } from "next/cache";
import { EstadoCuenta, EstadoIdea, EstadoPublicacion, TipoPublicacion, type Cuenta } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { asegurarAccesoACuenta } from "@/lib/auth/cuenta-permitida";
import { prepararArchivo, prepararArchivos } from "@/lib/publicador/preparar-archivo";
import { driveClient } from "@/lib/drive/client";
import { storageClient } from "@/lib/storage/client";
import { tick } from "@/lib/worker/publicador-worker";
import { MAX_ARCHIVOS_CAROUSEL } from "@/lib/publicador/limites";
import { mintDriveAccessToken } from "@/lib/drive-oauth/mint-access-token";
import { listarArchivosDeCarpeta } from "@/lib/drive/listar-carpeta";
import { obtenerArchivoDeDrive } from "@/lib/drive/obtener-archivo";
import { parsearDriveFolderId, parsearDriveLink } from "@/lib/ideas/parsear-drive-file-id";
import { esFormatoMediaSoportado } from "@/lib/publicador/preparar-archivo";
import { tituloDesdeCaption } from "@/lib/ideas/titulo-desde-caption";

export interface CrearPublicacionInput {
  cuentaId: string;
  /** Todos elegidos en la misma sesión del Picker — ver ADR-0011. */
  archivos: { driveFileId: string; resourceKey?: string }[];
  /**
   * Token del Picker del usuario. Si falta (el link se pegó a mano, ver
   * resolverLinkDrive) se usa el de la conexión guardada en Configuración.
   */
  driveAccessToken?: string;
  tipoPublicacion: TipoPublicacion;
  caption: string;
  /** Nulo = publicar apenas la cola la procese ("ahora"). Con valor = programada. */
  programadaPara: Date | null;
}

export interface CrearPublicacionResultado {
  estado: EstadoPublicacion;
  error?: string;
}

/**
 * Crea una Publicación "simple" (Historia, Reel, o Post de un solo archivo):
 * prepara el archivo (baja de Drive, sube a Storage — ver ADR-0009, tiene que
 * pasar ya, con el token de Drive fresco) y guarda la fila con los campos
 * sueltos de `Publicacion` (sin filas en `archivos`).
 */
async function crearPublicacionSimple(
  cuenta: Cuenta,
  driveFileId: string,
  resourceKey: string | undefined,
  input: Pick<CrearPublicacionInput, "tipoPublicacion" | "caption" | "programadaPara"> & { driveAccessToken: string },
  ideaId: string
): Promise<string> {
  const preparado = await prepararArchivo(
    { driveFileId, resourceKey, driveAccessToken: input.driveAccessToken, tipoPublicacion: input.tipoPublicacion },
    { drive: driveClient, storage: storageClient }
  );

  if (!preparado.ok) {
    const publicacion = await prisma.publicacion.create({
      data: {
        cuentaId: cuenta.id,
        tipo: input.tipoPublicacion,
        driveFileId,
        caption: input.caption || null,
        programadaPara: input.programadaPara,
        estado: EstadoPublicacion.fallida,
        error: preparado.error,
        ideaId,
      },
    });
    return publicacion.id;
  }

  const publicacion = await prisma.publicacion.create({
    data: {
      cuentaId: cuenta.id,
      tipo: input.tipoPublicacion,
      driveFileId,
      caption: input.caption || null,
      programadaPara: input.programadaPara,
      tipoMedia: preparado.tipoMedia,
      storageUrl: preparado.storageUrl,
      estado: EstadoPublicacion.pendiente,
      ideaId,
    },
  });
  return publicacion.id;
}

/**
 * Crea una Publicación carousel (Post con 2-10 archivos, ver ADR-0011):
 * prepara todos los archivos y los guarda como `PublicacionArchivo` hijos de
 * una única fila de `Publicacion` (sin driveFileId/tipoMedia/storageUrl
 * propios — esos campos son del caso simple).
 */
async function crearPublicacionCarousel(
  cuenta: Cuenta,
  input: CrearPublicacionInput & { driveAccessToken: string },
  ideaId: string
): Promise<string> {
  const preparado = await prepararArchivos(
    { archivos: input.archivos, driveAccessToken: input.driveAccessToken, tipoPublicacion: input.tipoPublicacion },
    { drive: driveClient, storage: storageClient }
  );

  if (!preparado.ok) {
    const publicacion = await prisma.publicacion.create({
      data: {
        cuentaId: cuenta.id,
        tipo: input.tipoPublicacion,
        caption: input.caption || null,
        programadaPara: input.programadaPara,
        estado: EstadoPublicacion.fallida,
        error: preparado.error,
        ideaId,
      },
    });
    return publicacion.id;
  }

  const publicacion = await prisma.publicacion.create({
    data: {
      cuentaId: cuenta.id,
      tipo: input.tipoPublicacion,
      caption: input.caption || null,
      programadaPara: input.programadaPara,
      estado: EstadoPublicacion.pendiente,
      ideaId,
      archivos: {
        create: preparado.archivos.map((archivo, orden) => ({
          orden,
          driveFileId: archivo.driveFileId,
          tipoMedia: archivo.tipoMedia,
          storageUrl: archivo.storageUrl,
        })),
      },
    },
  });
  return publicacion.id;
}

/**
 * Crea una o varias Publicaciones a partir de los archivos elegidos en el
 * Picker (ver ADR-0011): Post con 2-10 archivos se crea como un único
 * carousel; en cualquier otro caso (Historia, Reel, o Post de 1 archivo) cada
 * archivo se crea como su propia Publicación independiente. Al final dispara
 * la cola una sola vez: en el caso común (nada más corriendo) esto ya deja
 * publicadas las que sean "ahora" antes de responder.
 */
export async function crearPublicacion(
  input: CrearPublicacionInput
): Promise<CrearPublicacionResultado[]> {
  const cuenta = await prisma.cuenta.findUnique({ where: { id: input.cuentaId } });
  if (!cuenta || cuenta.estado !== EstadoCuenta.conectada) {
    throw new Error("La Cuenta elegida no está conectada.");
  }
  await asegurarAccesoACuenta(cuenta.id);
  if (input.archivos.length === 0) {
    throw new Error("Elegí al menos un archivo de Drive.");
  }
  if (input.tipoPublicacion === TipoPublicacion.reel && input.archivos.length > 1) {
    throw new Error("Un Reel es un solo video.");
  }
  if (input.tipoPublicacion === TipoPublicacion.post && input.archivos.length > MAX_ARCHIVOS_CAROUSEL) {
    throw new Error(`Instagram permite hasta ${MAX_ARCHIVOS_CAROUSEL} elementos por carousel.`);
  }

  const driveAccessToken = input.driveAccessToken ?? (await mintDriveAccessToken());
  const conToken = { ...input, driveAccessToken };
  const esCarousel = input.tipoPublicacion === TipoPublicacion.post && input.archivos.length > 1;

  // Toda Publicación nace vinculada a una Idea (ver ADR-0019), así aparece
  // en Ideas y en el calendario como cualquier otra. Se crea sin fecha para
  // que el worker de Ideas no la vea elegible mientras se prepara el archivo
  // (puede tardar segundos); la fecha se setea recién cuando ya están creadas
  // las Publicaciones, que a esa altura cuentan como "ya promocionada".
  const idea = await prisma.idea.create({
    data: {
      cuentaId: cuenta.id,
      titulo: tituloDesdeCaption(input.caption, `${input.tipoPublicacion} sin título`),
      tipo: input.tipoPublicacion,
      caption: input.caption || null,
      estado: EstadoIdea.enDrive,
      driveFileId: input.archivos.length === 1 ? input.archivos[0].driveFileId : null,
      driveResourceKey: input.archivos.length === 1 ? (input.archivos[0].resourceKey ?? null) : null,
      archivos:
        input.archivos.length > 1
          ? {
              create: input.archivos.map((archivo, orden) => ({
                orden,
                driveFileId: archivo.driveFileId,
                driveResourceKey: archivo.resourceKey ?? null,
              })),
            }
          : undefined,
    },
  });

  const ids: string[] = [];
  try {
    if (esCarousel) {
      ids.push(await crearPublicacionCarousel(cuenta, conToken, idea.id));
    } else {
      // Secuencial (no Promise.all): el orden elegido en el Picker tiene que
      // quedar reflejado en `creadaEn`, que es lo que usa la cola para decidir
      // qué Historia sale primero cuando hay varias "ahora" en simultáneo.
      for (const archivo of input.archivos) {
        ids.push(await crearPublicacionSimple(cuenta, archivo.driveFileId, archivo.resourceKey, conToken, idea.id));
      }
    }
  } catch (error) {
    // Sin ninguna Publicación creada la Idea quedaría huérfana y sin fecha.
    if (ids.length === 0) await prisma.idea.delete({ where: { id: idea.id } }).catch(() => {});
    throw error;
  }

  // "Ahora" también queda con fecha (la de creación) para que se vea en el calendario.
  await prisma.idea.update({
    where: { id: idea.id },
    data: { programadaPara: input.programadaPara ?? new Date() },
  });

  await tick();

  const publicaciones = await prisma.publicacion.findMany({ where: { id: { in: ids } } });
  const porId = new Map(publicaciones.map((p) => [p.id, p]));
  revalidarPublicaciones();
  return ids.map((id) => {
    const publicacion = porId.get(id)!;
    return { estado: publicacion.estado, error: publicacion.error ?? undefined };
  });
}

function revalidarPublicaciones() {
  revalidatePath("/publicar");
  revalidatePath("/ideas");
  revalidatePath("/ideas/calendario");
  revalidatePath("/ideas/[id]", "page");
}

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

/** Solo se puede cancelar mientras siga "pendiente" — no si la cola ya la disparó. */
export async function cancelarPublicacion(id: string): Promise<void> {
  const publicacion = await prisma.publicacion.findUnique({ where: { id }, include: { archivos: true } });
  if (!publicacion) throw new Error("Publicación no encontrada.");
  await asegurarAccesoACuenta(publicacion.cuentaId);

  const { count } = await prisma.publicacion.updateMany({
    where: { id, estado: EstadoPublicacion.pendiente },
    data: { estado: EstadoPublicacion.cancelada },
  });
  if (count === 0) {
    throw new Error("La Publicación ya se disparó, no se puede cancelar.");
  }

  if (publicacion.archivos.length > 0) {
    await Promise.all(
      publicacion.archivos.map((archivo) => storageClient.borrar(archivo.driveFileId).catch(() => {}))
    );
  } else if (publicacion.storageUrl && publicacion.driveFileId) {
    await storageClient.borrar(publicacion.driveFileId).catch(() => {});
  }
  revalidarPublicaciones();
}
