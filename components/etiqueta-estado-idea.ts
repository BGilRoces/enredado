import { EstadoIdea, EstadoPublicacion } from "@prisma/client";
import { claseBadgeEstado, etiquetaEstado } from "./etiqueta-estado";

const ETIQUETAS: Record<EstadoIdea, string> = {
  idea: "Idea",
  guionada: "Guionada",
  grabada: "Grabada",
  editada: "Editado",
  enDrive: "En Drive",
};

/** Clases de badge por estado, mismo patrón que components/etiqueta-estado.ts. */
const BADGES: Record<EstadoIdea, string> = {
  idea: "bg-zinc-100 text-zinc-600",
  guionada: "bg-sky-100 text-sky-700",
  grabada: "bg-violet-100 text-violet-700",
  editada: "bg-fuchsia-100 text-fuchsia-700",
  enDrive: "bg-amber-100 text-amber-700",
};

const BADGE_PUBLICADA_A_MANO = "bg-emerald-600 text-white";
const BADGE_PROGRAMADA_EN_IG = "bg-emerald-100 text-emerald-700";
const BADGE_FALTA_PROGRAMAR = "bg-rose-100 text-rose-700";

/** Estados desde los que la Idea ya está lista para cargarse en la app de Instagram (Editado o En Drive). */
export const ESTADOS_LISTOS_PARA_PROGRAMAR: EstadoIdea[] = [EstadoIdea.editada, EstadoIdea.enDrive];

export interface IdeaConEstado {
  estado: EstadoIdea;
  programadaPara: Date | null;
  /** Ya la programaron a mano en la app de Instagram (ver ADR-0020). */
  programadaEnIgEl: Date | null;
  /** La dueña/el dueño la marcó como publicada en Instagram. */
  publicadaEl?: Date | null;
  // Sólo importa el historial: lo que el panel publicó antes de ADR-0020.
  publicaciones: { estado: EstadoPublicacion; programadaPara: Date | null }[];
}

/**
 * Una Idea editada o `enDrive` con fecha es contenido listo: lo único que falta
 * es programarlo en la app de Instagram (ver ADR-0020). Sin fecha todavía no se
 * sabe cuándo, así que es sólo "Editado"/"En Drive".
 */
export function faltaProgramarEnIg(idea: Pick<IdeaConEstado, "estado" | "programadaPara" | "programadaEnIgEl">): boolean {
  return ESTADOS_LISTOS_PARA_PROGRAMAR.includes(idea.estado) && idea.programadaPara !== null && idea.programadaEnIgEl === null;
}

function estaProgramadaEnIg(idea: IdeaConEstado): boolean {
  return ESTADOS_LISTOS_PARA_PROGRAMAR.includes(idea.estado) && idea.programadaEnIgEl !== null;
}

function publicadas(publicaciones: IdeaConEstado["publicaciones"]) {
  return publicaciones.filter((p) => p.estado === EstadoPublicacion.publicada);
}

/** Lo que el panel publicó antes de ADR-0020 sigue mostrándose como "Publicada"; el resto de las Publicaciones ya no cuenta. */
export function etiquetaEstadoIdea(idea: IdeaConEstado): string {
  if (idea.publicadaEl) return "Publicado";
  const hechas = publicadas(idea.publicaciones);
  if (hechas.length > 0) return etiquetaEstado(hechas[0]);
  if (estaProgramadaEnIg(idea)) return "Programada en IG";
  if (faltaProgramarEnIg(idea)) return "Falta programar";
  return ETIQUETAS[idea.estado];
}

export function claseBadgeEstadoIdea(idea: IdeaConEstado): string {
  if (idea.publicadaEl) return BADGE_PUBLICADA_A_MANO;
  const hechas = publicadas(idea.publicaciones);
  if (hechas.length > 0) return claseBadgeEstado(hechas[0]);
  if (estaProgramadaEnIg(idea)) return BADGE_PROGRAMADA_EN_IG;
  if (faltaProgramarEnIg(idea)) return BADGE_FALTA_PROGRAMAR;
  return BADGES[idea.estado];
}

export { ETIQUETAS as ETIQUETAS_POR_ESTADO_IDEA };
