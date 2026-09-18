"use server";

import { revalidatePath } from "next/cache";
import { EstadoIdea, EstadoPublicacion, TipoPublicacion, type Idea } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { asegurarAccesoACuenta } from "@/lib/auth/cuenta-permitida";
import { parsearDriveLink } from "@/lib/ideas/parsear-drive-file-id";
import { cancelarPublicacion } from "@/app/publicar/actions";

function revalidarIdeas() {
  revalidatePath("/ideas");
  revalidatePath("/ideas/calendario");
}

async function obtenerIdeaOTirar(id: string): Promise<Idea> {
  const idea = await prisma.idea.findUnique({ where: { id } });
  if (!idea) throw new Error("Idea no encontrada.");
  await asegurarAccesoACuenta(idea.cuentaId);
  return idea;
}

/** Una vez promocionada (ver ADR-0013), cambiar el archivo/tipo no tiene efecto sobre la Publicación ya creada. */
function asegurarNoPromocionada(idea: Idea) {
  if (idea.publicacionId) {
    throw new Error("Esta Idea ya se promocionó a una Publicación, no se puede editar así.");
  }
}

export interface CrearIdeaInput {
  cuentaId: string;
  titulo: string;
  tipo: TipoPublicacion;
  descripcion?: string;
  guion?: string;
  linkReferencia1?: string;
  linkReferencia2?: string;
}

export async function crearIdea(input: CrearIdeaInput): Promise<string> {
  const cuenta = await prisma.cuenta.findUnique({ where: { id: input.cuentaId } });
  if (!cuenta) throw new Error("La Cuenta elegida no existe.");
  await asegurarAccesoACuenta(cuenta.id);
  if (!input.titulo.trim()) throw new Error("El título no puede estar vacío.");

  const idea = await prisma.idea.create({
    data: {
      cuentaId: cuenta.id,
      titulo: input.titulo.trim(),
      tipo: input.tipo,
      descripcion: input.descripcion || null,
      guion: input.guion || null,
      linkReferencia1: input.linkReferencia1 || null,
      linkReferencia2: input.linkReferencia2 || null,
      estado: EstadoIdea.idea,
    },
  });
  revalidarIdeas();
  return idea.id;
}

export interface ActualizarIdeaInput {
  titulo: string;
  descripcion?: string;
  guion?: string;
  linkReferencia1?: string;
  linkReferencia2?: string;
  caption?: string;
}

/**
 * Título/descripción/guión/links son notas, siempre editables. El tipo y la
 * Cuenta no lo son (mismo criterio que editarPublicacion): cambiarlos después
 * de promocionada invalidaría la Publicación ya creada.
 */
export async function actualizarIdea(id: string, data: ActualizarIdeaInput): Promise<void> {
  const idea = await obtenerIdeaOTirar(id);
  if (!data.titulo.trim()) throw new Error("El título no puede estar vacío.");

  await prisma.idea.update({
    where: { id },
    data: {
      titulo: data.titulo.trim(),
      descripcion: data.descripcion || null,
      guion: data.guion || null,
      linkReferencia1: data.linkReferencia1 || null,
      linkReferencia2: data.linkReferencia2 || null,
      caption: data.caption || null,
    },
  });

  // Si ya se promocionó pero la Publicación sigue pendiente, el caption real
  // que va a salir en Instagram también se re-sincroniza (mismo texto que ve
  // el usuario acá, para que no queden desalineados).
  if (idea.publicacionId) {
    await prisma.publicacion.updateMany({
      where: { id: idea.publicacionId, estado: EstadoPublicacion.pendiente },
      data: { caption: data.caption || null },
    });
  }

  revalidarIdeas();
}

/** Parsea y valida el link antes de marcar "en Drive" — evita el estado intermedio inválido "enDrive sin link". */
export async function marcarEnDrive(id: string, driveLink: string): Promise<void> {
  const idea = await obtenerIdeaOTirar(id);
  asegurarNoPromocionada(idea);

  const parseado = parsearDriveLink(driveLink);
  if (!parseado) {
    throw new Error("Ese link no parece ser de un archivo de Google Drive (probá con el de \"Compartir\").");
  }

  await prisma.idea.update({
    where: { id },
    data: {
      driveLink: driveLink.trim(),
      driveFileId: parseado.driveFileId,
      driveResourceKey: parseado.resourceKey ?? null,
      estado: EstadoIdea.enDrive,
    },
  });
  revalidarIdeas();
}

const ESTADOS_MANUALES = [EstadoIdea.idea, EstadoIdea.guionada, EstadoIdea.grabada] as const;

/** Para enDrive hay que pasar por marcarEnDrive (necesita el link) — acá sólo el resto de las transiciones. */
export async function cambiarEstadoIdea(id: string, estado: (typeof ESTADOS_MANUALES)[number]): Promise<void> {
  if (!ESTADOS_MANUALES.includes(estado)) {
    throw new Error('Para pasar a "en Drive" hay que pegar el link del archivo.');
  }
  const idea = await obtenerIdeaOTirar(id);
  asegurarNoPromocionada(idea);

  await prisma.idea.update({ where: { id }, data: { estado } });
  revalidarIdeas();
}

/**
 * Calendarizar = setear `programadaPara` en la misma fila (ver ADR-0013), no
 * crea nada nuevo. Si ya se promocionó, sólo se puede recalendarizar
 * mientras la Publicación siga pendiente (no si ya se disparó).
 */
export async function calendarizarIdea(id: string, programadaPara: Date): Promise<void> {
  const idea = await obtenerIdeaOTirar(id);

  if (idea.publicacionId) {
    const { count } = await prisma.publicacion.updateMany({
      where: { id: idea.publicacionId, estado: EstadoPublicacion.pendiente },
      data: { programadaPara },
    });
    if (count === 0) {
      throw new Error("La Publicación ya se disparó, no se puede recalendarizar.");
    }
  }

  await prisma.idea.update({ where: { id }, data: { programadaPara } });
  revalidarIdeas();
}

/** Si ya estaba promocionada, cancela la Publicación vinculada (reusa cancelarPublicacion, no la reimplementa). */
export async function descalendarizarIdea(id: string): Promise<void> {
  const idea = await obtenerIdeaOTirar(id);

  if (idea.publicacionId) {
    await cancelarPublicacion(idea.publicacionId);
  }

  await prisma.idea.update({ where: { id }, data: { programadaPara: null, publicacionId: null } });
  revalidarIdeas();
}

/** Cancela la Publicación vinculada si todavía se puede (best-effort) y borra la Idea. */
export async function eliminarIdea(id: string): Promise<void> {
  const idea = await obtenerIdeaOTirar(id);

  if (idea.publicacionId) {
    await cancelarPublicacion(idea.publicacionId).catch(() => {});
  }

  await prisma.idea.delete({ where: { id } });
  revalidarIdeas();
}
