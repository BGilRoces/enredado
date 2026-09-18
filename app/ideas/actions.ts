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
import { cancelarPublicacion } from "@/app/publicar/actions";

type IdeaConPublicaciones = Idea & { publicaciones: Pick<Publicacion, "id" | "estado">[] };

function revalidarIdeas() {
  revalidatePath("/ideas");
  revalidatePath("/ideas/calendario");
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

/** Una vez promocionada (ver ADR-0013), cambiar el archivo/carpeta/tipo no tiene efecto sobre lo ya creado. */
function asegurarNoPromocionada(idea: IdeaConPublicaciones) {
  if (idea.publicaciones.length > 0) {
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
 * de promocionada invalidaría la(s) Publicación(es) ya creada(s).
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

  // Si ya se promocionó pero alguna Publicación vinculada sigue pendiente, el
  // caption real que va a salir en Instagram también se re-sincroniza (mismo
  // texto que ve el usuario acá, para que no queden desalineados).
  const idsPendientes = idea.publicaciones.filter((p) => p.estado === EstadoPublicacion.pendiente).map((p) => p.id);
  if (idsPendientes.length > 0) {
    await prisma.publicacion.updateMany({
      where: { id: { in: idsPendientes }, estado: EstadoPublicacion.pendiente },
      data: { caption: data.caption || null },
    });
  }

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

/** Reordena los archivos de la carpeta de una Idea (ver ADR-0016) — swap simple con el vecino, sin drag-and-drop. */
export async function moverArchivoIdea(id: string, archivoId: string, direccion: "arriba" | "abajo"): Promise<void> {
  const idea = await obtenerIdeaOTirar(id);
  asegurarNoPromocionada(idea);

  const archivos = await prisma.ideaArchivo.findMany({ where: { ideaId: id }, orderBy: { orden: "asc" } });
  const indice = archivos.findIndex((a) => a.id === archivoId);
  if (indice === -1) throw new Error("Archivo no encontrado.");

  const destino = direccion === "arriba" ? indice - 1 : indice + 1;
  if (destino < 0 || destino >= archivos.length) return; // ya está en la punta, no-op

  const actual = archivos[indice];
  const vecino = archivos[destino];
  await prisma.$transaction([
    prisma.ideaArchivo.update({ where: { id: actual.id }, data: { orden: vecino.orden } }),
    prisma.ideaArchivo.update({ where: { id: vecino.id }, data: { orden: actual.orden } }),
  ]);
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
 * crea nada nuevo. Si ya se promocionó a una o más Publicaciones (ver
 * ADR-0016), sólo se puede recalendarizar mientras TODAS sigan pendientes —
 * una vez que alguna ya se disparó, un cambio de fecha parcial dejaría el
 * grupo inconsistente.
 */
export async function calendarizarIdea(id: string, programadaPara: Date): Promise<void> {
  const idea = await obtenerIdeaOTirar(id);

  if (idea.publicaciones.length > 0) {
    if (idea.publicaciones.some((p) => p.estado !== EstadoPublicacion.pendiente)) {
      throw new Error("Ya se disparó alguna Publicación de esta Idea, no se puede recalendarizar.");
    }
    await prisma.publicacion.updateMany({
      where: { id: { in: idea.publicaciones.map((p) => p.id) }, estado: EstadoPublicacion.pendiente },
      data: { programadaPara },
    });
  }

  await prisma.idea.update({ where: { id }, data: { programadaPara } });
  revalidarIdeas();
}

/**
 * Si ya estaba promocionada, cancela todas las Publicaciones vinculadas que
 * sigan pendientes (reusa cancelarPublicacion, no la reimplementa) y las
 * desvincula, para que la Idea quede libre de promocionarse de nuevo más
 * adelante si se recalendariza.
 */
export async function descalendarizarIdea(id: string): Promise<void> {
  const idea = await obtenerIdeaOTirar(id);

  const pendientes = idea.publicaciones.filter((p) => p.estado === EstadoPublicacion.pendiente);
  for (const publicacion of pendientes) {
    await cancelarPublicacion(publicacion.id);
  }
  if (pendientes.length > 0) {
    await prisma.publicacion.updateMany({
      where: { id: { in: pendientes.map((p) => p.id) } },
      data: { ideaId: null },
    });
  }

  await prisma.idea.update({ where: { id }, data: { programadaPara: null } });
  revalidarIdeas();
}

/** Cancela las Publicaciones vinculadas que todavía se puedan (best-effort) y borra la Idea. */
export async function eliminarIdea(id: string): Promise<void> {
  const idea = await obtenerIdeaOTirar(id);

  for (const publicacion of idea.publicaciones) {
    if (publicacion.estado === EstadoPublicacion.pendiente) {
      await cancelarPublicacion(publicacion.id).catch(() => {});
    }
  }

  await prisma.idea.delete({ where: { id } });
  revalidarIdeas();
}
