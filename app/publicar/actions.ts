"use server";

import { revalidatePath } from "next/cache";
import { EstadoCuenta, EstadoPublicacion, TipoPublicacion, type Cuenta } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { prepararArchivo, prepararArchivos } from "@/lib/publicador/preparar-archivo";
import { driveClient } from "@/lib/drive/client";
import { storageClient } from "@/lib/storage/client";
import { tick } from "@/lib/worker/publicador-worker";

/** Límite fijo de Instagram: un carousel admite entre 2 y 10 elementos. */
const MAX_ARCHIVOS_CAROUSEL = 10;

export interface CrearPublicacionInput {
  cuentaId: string;
  /** Todos elegidos en la misma sesión del Picker — ver ADR-0011. */
  archivos: { driveFileId: string }[];
  driveAccessToken: string;
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
  input: Pick<CrearPublicacionInput, "driveAccessToken" | "tipoPublicacion" | "caption" | "programadaPara">
): Promise<string> {
  const preparado = await prepararArchivo(
    { driveFileId, driveAccessToken: input.driveAccessToken, tipoPublicacion: input.tipoPublicacion },
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
  input: CrearPublicacionInput
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
  if (input.archivos.length === 0) {
    throw new Error("Elegí al menos un archivo de Drive.");
  }
  if (input.tipoPublicacion === TipoPublicacion.reel && input.archivos.length > 1) {
    throw new Error("Un Reel es un solo video.");
  }
  if (input.tipoPublicacion === TipoPublicacion.post && input.archivos.length > MAX_ARCHIVOS_CAROUSEL) {
    throw new Error(`Instagram permite hasta ${MAX_ARCHIVOS_CAROUSEL} elementos por carousel.`);
  }

  const esCarousel = input.tipoPublicacion === TipoPublicacion.post && input.archivos.length > 1;

  const ids = esCarousel
    ? [await crearPublicacionCarousel(cuenta, input)]
    : await Promise.all(input.archivos.map((archivo) => crearPublicacionSimple(cuenta, archivo.driveFileId, input)));

  await tick();

  const publicaciones = await prisma.publicacion.findMany({ where: { id: { in: ids } } });
  const porId = new Map(publicaciones.map((p) => [p.id, p]));
  revalidatePath("/publicar");
  return ids.map((id) => {
    const publicacion = porId.get(id)!;
    return { estado: publicacion.estado, error: publicacion.error ?? undefined };
  });
}

/** Solo se puede cancelar mientras siga "pendiente" — no si la cola ya la disparó. */
export async function cancelarPublicacion(id: string): Promise<void> {
  const publicacion = await prisma.publicacion.findUnique({ where: { id }, include: { archivos: true } });
  if (!publicacion) throw new Error("Publicación no encontrada.");

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
  revalidatePath("/publicar");
}

export interface EditarPublicacionInput {
  caption: string;
  /** Nulo = pasa a "ahora" (vence de inmediato). */
  programadaPara: Date | null;
}

/**
 * Solo se puede editar mientras siga "pendiente" — no si la cola ya la
 * disparó. El tipo y la Cuenta no son editables: cambiarlos invalidaría el
 * archivo ya preparado en Storage (ver ADR-0009).
 */
export async function editarPublicacion(id: string, data: EditarPublicacionInput): Promise<void> {
  const { count } = await prisma.publicacion.updateMany({
    where: { id, estado: EstadoPublicacion.pendiente },
    data: { caption: data.caption || null, programadaPara: data.programadaPara },
  });
  if (count === 0) {
    throw new Error("La Publicación ya se disparó, no se puede editar.");
  }
  revalidatePath("/publicar");
}
