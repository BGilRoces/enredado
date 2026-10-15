"use server";

import { revalidatePath } from "next/cache";
import { EstadoIdea, EstadoPublicacion, TipoPublicacion, type Idea, type Publicacion } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { asegurarAccesoACuenta } from "@/lib/auth/cuenta-permitida";
import { esFormatoMediaSoportado } from "@/lib/publicador/preparar-archivo";
import { MAX_ARCHIVOS_CAROUSEL } from "@/lib/publicador/limites";
import { parsearDriveFolderId, parsearDriveLink } from "@/lib/ideas/parsear-drive-file-id";
import { mintDriveAccessToken } from "@/lib/drive-oauth/mint-access-token";
import { listarArchivosDeCarpeta } from "@/lib/drive/listar-carpeta";
import { mensajeDeError } from "@/lib/mensaje-de-error";

type IdeaConPublicaciones = Idea & { publicaciones: Pick<Publicacion, "id" | "estado">[] };

function revalidarIdeas() {
  revalidatePath("/ideas");
  revalidatePath("/ideas/calendario");
  // Sin esto, una acción disparada desde /ideas/[id] guardaba en la base pero
  // la página no se volvía a renderizar: parecía que no pasaba nada.
  revalidatePath("/ideas/[id]", "page");
}

async function obtenerIdeaOTirar(id: string): Promise<IdeaConPublicaciones> {
  const idea = await prisma.idea.findUnique({
    where: { id },
    include: { publicaciones: { select: { id: true, estado: true } } },
  });
  if (!idea) throw new Error("Idea no encontrada.");
  await asegurarAccesoACuenta(idea.cuentaId);
  return idea;
}

/** Sólo las Ideas que el panel ya publicó (historial anterior a ADR-0020) quedan congeladas: ahí el archivo ya salió. */
function asegurarNoPromocionada(idea: IdeaConPublicaciones) {
  if (idea.publicaciones.some((p) => p.estado === EstadoPublicacion.publicada)) {
    throw new Error("Esta Idea ya se publicó, no se puede editar así.");
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
  caption?: string;
  audio?: string;
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
      caption: input.caption || null,
      audio: input.audio?.trim() || null,
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
  audio?: string;
}

/**
 * Título/descripción/guión/links/caption/audio son notas, siempre editables.
 */
export async function actualizarIdea(id: string, data: ActualizarIdeaInput): Promise<void> {
  await obtenerIdeaOTirar(id);
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
      audio: data.audio?.trim() || null,
    },
  });

  revalidarIdeas();
}

/**
 * Parsea y valida el link antes de marcar "en Drive" — evita el estado
 * intermedio inválido "enDrive sin archivo(s)". Acepta tanto el link de un
 * archivo puntual como el de una carpeta entera (ver ADR-0016): un Post con
 * carpeta se promociona como carousel, una Historia con carpeta como varias
 * Publicaciones seguidas — un Reel siempre es un solo video, así que una
 * carpeta no tiene sentido ahí.
 */
export async function marcarEnDrive(id: string, driveLink: string): Promise<void> {
  const idea = await obtenerIdeaOTirar(id);
  asegurarNoPromocionada(idea);

  const archivo = parsearDriveLink(driveLink);
  if (archivo) {
    await prisma.$transaction([
      prisma.ideaArchivo.deleteMany({ where: { ideaId: id } }),
      prisma.idea.update({
        where: { id },
        data: {
          driveLink: driveLink.trim(),
          driveFileId: archivo.driveFileId,
          driveResourceKey: archivo.resourceKey ?? null,
          estado: EstadoIdea.enDrive,
        },
      }),
    ]);
    revalidarIdeas();
    return;
  }

  const folderId = parsearDriveFolderId(driveLink);
  if (!folderId) {
    throw new Error('Ese link no parece ser de un archivo ni de una carpeta de Google Drive (probá con el de "Compartir").');
  }
  if (idea.tipo === TipoPublicacion.reel) {
    throw new Error("Un Reel es un solo video — pegá el link del archivo puntual, no el de una carpeta.");
  }

  let accessToken: string;
  try {
    accessToken = await mintDriveAccessToken();
  } catch (error) {
    throw new Error(mensajeDeError(error));
  }

  const archivosDeCarpeta = await listarArchivosDeCarpeta(folderId, accessToken);
  const soportados = archivosDeCarpeta.filter((a) => esFormatoMediaSoportado(a.mimeType));
  if (soportados.length === 0) {
    throw new Error("Esa carpeta no tiene fotos ni videos en un formato que Instagram acepte.");
  }

  const limite = idea.tipo === TipoPublicacion.post ? MAX_ARCHIVOS_CAROUSEL : soportados.length;
  const elegidos = soportados.slice(0, limite);

  await prisma.$transaction([
    prisma.ideaArchivo.deleteMany({ where: { ideaId: id } }),
    prisma.idea.update({
      where: { id },
      data: {
        driveLink: driveLink.trim(),
        driveFileId: null,
        driveResourceKey: null,
        estado: EstadoIdea.enDrive,
        archivos: {
          create: elegidos.map((a, orden) => ({
            orden,
            driveFileId: a.id,
            driveResourceKey: a.resourceKey ?? null,
            nombre: a.nombre,
          })),
        },
      },
    }),
  ]);
  revalidarIdeas();
}

/** Reordena los archivos de la carpeta de una Idea por drag-and-drop: recibe la lista completa de ids en el orden final. */
export async function reordenarArchivosIdea(id: string, idsEnOrden: string[]): Promise<void> {
  const idea = await obtenerIdeaOTirar(id);
  asegurarNoPromocionada(idea);

  const archivos = await prisma.ideaArchivo.findMany({ where: { ideaId: id } });
  const mismosIds =
    idsEnOrden.length === archivos.length && archivos.every((a) => idsEnOrden.includes(a.id));
  if (!mismosIds) {
    throw new Error("La lista de archivos cambió mientras tanto — recargá la página e intentá de nuevo.");
  }

  await prisma.$transaction(
    idsEnOrden.map((archivoId, orden) => prisma.ideaArchivo.update({ where: { id: archivoId }, data: { orden } }))
  );
  revalidarIdeas();
}

/**
 * Saca un archivo de la carpeta cargada sin subirlo — no toca nada en Drive,
 * sólo la selección local de la Idea. No deja vaciar del todo (ver
 * promoverIdea): si el usuario quiere una carpeta vacía tiene que sacar el
 * link de Drive en vez de borrar archivo por archivo.
 */
export async function eliminarArchivoIdea(id: string, archivoId: string): Promise<void> {
  const idea = await obtenerIdeaOTirar(id);
  asegurarNoPromocionada(idea);

  const restantes = await prisma.ideaArchivo.count({ where: { ideaId: id } });
  if (restantes <= 1) {
    throw new Error("No podés sacar el último archivo de la carpeta — pegá otro link de Drive si querés vaciarla.");
  }

  const { count } = await prisma.ideaArchivo.deleteMany({ where: { id: archivoId, ideaId: id } });
  if (count === 0) throw new Error("Archivo no encontrado.");
  revalidarIdeas();
}

const ESTADOS_MANUALES = [EstadoIdea.idea, EstadoIdea.guionada, EstadoIdea.grabada] as const;

/** Para enDrive hay que pasar por marcarEnDrive (necesita el link) — acá sólo el resto de las transiciones. */
export async function cambiarEstadoIdea(id: string, estado: (typeof ESTADOS_MANUALES)[number]): Promise<void> {
  if (!ESTADOS_MANUALES.includes(estado)) {
    throw new Error('Para pasar a "en Drive" hay que pegar el link del archivo o la carpeta.');
  }
  const idea = await obtenerIdeaOTirar(id);
  asegurarNoPromocionada(idea);

  await prisma.idea.update({ where: { id }, data: { estado } });
  revalidarIdeas();
}

/**
 * Calendarizar = setear `programadaPara` en la misma fila (ver ADR-0013), no
 * crea nada nuevo. Cambiar la fecha invalida la marca "programada en IG": lo
 * que ya quedó agendado en la app tiene la hora vieja y hay que rehacerlo.
 */
export async function calendarizarIdea(id: string, programadaPara: Date): Promise<void> {
  const idea = await obtenerIdeaOTirar(id);
  const cambioFecha = idea.programadaPara?.getTime() !== programadaPara.getTime();

  await prisma.idea.update({
    where: { id },
    data: { programadaPara, ...(cambioFecha && { programadaEnIgEl: null }) },
  });
  revalidarIdeas();
}

export async function descalendarizarIdea(id: string): Promise<void> {
  await obtenerIdeaOTirar(id);
  await prisma.idea.update({ where: { id }, data: { programadaPara: null, programadaEnIgEl: null } });
  revalidarIdeas();
}

/**
 * Marca (o desmarca) que la Idea ya quedó programada en la app de Instagram
 * (ver ADR-0020). Es lo único que "programar" significa en el panel: no
 * publica nada, sólo saca la Idea de la lista de "falta programar en IG".
 */
export async function marcarProgramadaEnIg(id: string, programada: boolean): Promise<void> {
  const idea = await obtenerIdeaOTirar(id);
  if (programada && !idea.programadaPara) {
    throw new Error("Primero ponele fecha y hora a la Idea (la que programaste en Instagram).");
  }
  await prisma.idea.update({ where: { id }, data: { programadaEnIgEl: programada ? new Date() : null } });
  revalidarIdeas();
  revalidatePath("/");
}

/** Borra la Idea; lo ya publicado en Instagram y el historial de Publicaciones no se tocan (se desvinculan). */
export async function eliminarIdea(id: string): Promise<void> {
  await obtenerIdeaOTirar(id);
  await prisma.idea.delete({ where: { id } });
  revalidarIdeas();
}
