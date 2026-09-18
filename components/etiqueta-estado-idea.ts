import { EstadoIdea } from "@prisma/client";
import { claseBadgeEstado, etiquetaEstado } from "./etiqueta-estado";
import type { EstadoPublicacion } from "@prisma/client";

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

export interface IdeaConEstado {
  estado: EstadoIdea;
  programadaPara: Date | null;
  publicacion: { estado: EstadoPublicacion; programadaPara: Date | null } | null;
}

/**
 * Una vez promocionada (`publicacion` no nulo, ver ADR-0013), el badge pasa a
 * mostrar el estado real de la Publicación (Publicada/Fallida/Programada...)
 * en vez de quedar pegado en "En Drive" para siempre.
 */
export function etiquetaEstadoIdea(idea: IdeaConEstado): string {
  if (idea.publicacion) return etiquetaEstado(idea.publicacion);
  return ETIQUETAS[idea.estado];
}

export function claseBadgeEstadoIdea(idea: IdeaConEstado): string {
  if (idea.publicacion) return claseBadgeEstado(idea.publicacion);
  return BADGES[idea.estado];
}

export { ETIQUETAS as ETIQUETAS_POR_ESTADO_IDEA };
