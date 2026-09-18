import { EstadoIdea, EstadoPublicacion } from "@prisma/client";
import { claseBadgeEstado, etiquetaEstado } from "./etiqueta-estado";

const ETIQUETAS: Record<EstadoIdea, string> = {
  idea: "Idea",
  guionada: "Guionada",
  grabada: "Grabada",
  enDrive: "En Drive",
};

/** Clases de badge por estado, mismo patrón que components/etiqueta-estado.ts. */
const BADGES: Record<EstadoIdea, string> = {
  idea: "bg-zinc-100 text-zinc-600",
  guionada: "bg-sky-100 text-sky-700",
  grabada: "bg-violet-100 text-violet-700",
  enDrive: "bg-amber-100 text-amber-700",
};

/** Peor-primero: si el grupo tiene alguna en este estado, es la más relevante para mostrar como resumen. */
const PRIORIDAD: EstadoPublicacion[] = [
  EstadoPublicacion.fallida,
  EstadoPublicacion.bloqueadaPorLimite,
  EstadoPublicacion.publicando,
  EstadoPublicacion.pendiente,
  EstadoPublicacion.cancelada,
  EstadoPublicacion.publicada,
];

export interface IdeaConEstado {
  estado: EstadoIdea;
  programadaPara: Date | null;
  // Puede ser más de una (ver ADR-0016): una Idea con carpeta de Historias
  // promociona a varias Publicaciones independientes.
  publicaciones: { estado: EstadoPublicacion; programadaPara: Date | null }[];
}

/** De un grupo de Publicaciones, la más relevante para resumir en un solo badge (ver PRIORIDAD arriba). */
function representativa(publicaciones: IdeaConEstado["publicaciones"]) {
  for (const estado of PRIORIDAD) {
    const encontrada = publicaciones.find((p) => p.estado === estado);
    if (encontrada) return encontrada;
  }
  return publicaciones[0];
}

/**
 * Una vez promocionada (`publicaciones` no vacío, ver ADR-0013), el badge
 * pasa a mostrar el estado real (Publicada/Fallida/Programada...) en vez de
 * quedar pegado en "En Drive" para siempre. Con más de una Publicación (ver
 * ADR-0016) se suma un contador tipo "(2/3)" salvo que estén todas iguales.
 */
export function etiquetaEstadoIdea(idea: IdeaConEstado): string {
  if (idea.publicaciones.length === 0) return ETIQUETAS[idea.estado];

  const base = etiquetaEstado(representativa(idea.publicaciones));
  if (idea.publicaciones.length === 1) return base;

  const todasIguales = idea.publicaciones.every((p) => p.estado === idea.publicaciones[0].estado);
  if (todasIguales) return base;

  const publicadas = idea.publicaciones.filter((p) => p.estado === EstadoPublicacion.publicada).length;
  return `${base} (${publicadas}/${idea.publicaciones.length})`;
}

export function claseBadgeEstadoIdea(idea: IdeaConEstado): string {
  if (idea.publicaciones.length === 0) return BADGES[idea.estado];
  return claseBadgeEstado(representativa(idea.publicaciones));
}

export { ETIQUETAS as ETIQUETAS_POR_ESTADO_IDEA };
