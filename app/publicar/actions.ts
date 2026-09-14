"use server";

import { revalidatePath } from "next/cache";
import { EstadoCuenta, EstadoPublicacion, type TipoPublicacion } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { prepararArchivo } from "@/lib/publicador/preparar-archivo";
import { driveClient } from "@/lib/drive/client";
import { storageClient } from "@/lib/storage/client";
import { tick } from "@/lib/worker/publicador-worker";

export interface CrearPublicacionInput {
  cuentaId: string;
  driveFileId: string;
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
 * Crea la Publicación: primero prepara el archivo (baja de Drive, sube a
 * Storage — ver ADR-0009, tiene que pasar ya, con el token de Drive fresco).
 * Si es "ahora" (sin programadaPara), dispara la cola de una: en el caso
 * común (nada más corriendo) esto ya la deja publicada antes de responder.
 */
export async function crearPublicacion(
  input: CrearPublicacionInput
): Promise<CrearPublicacionResultado> {
  const cuenta = await prisma.cuenta.findUnique({ where: { id: input.cuentaId } });
  if (!cuenta || cuenta.estado !== EstadoCuenta.conectada) {
    throw new Error("La Cuenta elegida no está conectada.");
  }

  const preparado = await prepararArchivo(
    {
      driveFileId: input.driveFileId,
      driveAccessToken: input.driveAccessToken,
      tipoPublicacion: input.tipoPublicacion,
    },
    { drive: driveClient, storage: storageClient }
  );

  if (!preparado.ok) {
    const publicacion = await prisma.publicacion.create({
      data: {
        cuentaId: cuenta.id,
        tipo: input.tipoPublicacion,
        driveFileId: input.driveFileId,
        caption: input.caption || null,
        programadaPara: input.programadaPara,
        estado: EstadoPublicacion.fallida,
        error: preparado.error,
      },
    });
    revalidatePath("/publicar");
    return { estado: publicacion.estado, error: publicacion.error ?? undefined };
  }

  const publicacion = await prisma.publicacion.create({
    data: {
      cuentaId: cuenta.id,
      tipo: input.tipoPublicacion,
      driveFileId: input.driveFileId,
      caption: input.caption || null,
      programadaPara: input.programadaPara,
      tipoMedia: preparado.tipoMedia,
      storageUrl: preparado.storageUrl,
      estado: EstadoPublicacion.pendiente,
    },
  });

  await tick();

  const actualizada = await prisma.publicacion.findUniqueOrThrow({ where: { id: publicacion.id } });
  revalidatePath("/publicar");
  return { estado: actualizada.estado, error: actualizada.error ?? undefined };
}

/** Solo se puede cancelar mientras siga "pendiente" — no si la cola ya la disparó. */
export async function cancelarPublicacion(id: string): Promise<void> {
  const publicacion = await prisma.publicacion.findUnique({ where: { id } });
  if (!publicacion) throw new Error("Publicación no encontrada.");

  const { count } = await prisma.publicacion.updateMany({
    where: { id, estado: EstadoPublicacion.pendiente },
    data: { estado: EstadoPublicacion.cancelada },
  });
  if (count === 0) {
    throw new Error("La Publicación ya se disparó, no se puede cancelar.");
  }

  if (publicacion.storageUrl) {
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
