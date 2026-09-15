import { EstadoPublicacion } from "@prisma/client";

const ETIQUETAS: Record<EstadoPublicacion, string> = {
  pendiente: "En cola",
  publicando: "Publicando",
  publicada: "Publicada",
  fallida: "Fallida",
  cancelada: "Cancelada",
  bloqueadaPorLimite: "Bloqueada por límite",
};

/** Clases de badge por estado, reusadas en /publicar y /historial. */
const BADGES: Record<EstadoPublicacion, string> = {
  pendiente: "bg-zinc-100 text-zinc-600",
  publicando: "bg-amber-100 text-amber-700",
  publicada: "bg-emerald-100 text-emerald-700",
  fallida: "bg-rose-100 text-rose-700",
  cancelada: "bg-zinc-100 text-zinc-400 line-through",
  bloqueadaPorLimite: "bg-orange-100 text-orange-700",
};

const BADGE_PROGRAMADA = "bg-sky-100 text-sky-700";

export function claseBadgeEstado(publicacion: {
  estado: EstadoPublicacion;
  programadaPara: Date | null;
}): string {
  if (publicacion.estado === EstadoPublicacion.pendiente && publicacion.programadaPara) {
    return BADGE_PROGRAMADA;
  }
  return BADGES[publicacion.estado];
}

/**
 * No existe un estado "programada" en la base — es "pendiente" con
 * `programadaPara` seteado (ver ADR-0009). Se distingue acá en la etiqueta,
 * así una Publicación programada que ya falló no se confunde con una que
 * todavía está esperando en la cola.
 */
export function etiquetaEstado(publicacion: {
  estado: EstadoPublicacion;
  programadaPara: Date | null;
}): string {
  if (publicacion.estado === EstadoPublicacion.pendiente && publicacion.programadaPara) {
    return "Programada";
  }
  return ETIQUETAS[publicacion.estado];
}

export { ETIQUETAS as ETIQUETAS_POR_ESTADO };
