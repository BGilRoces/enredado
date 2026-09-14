import { EstadoPublicacion } from "@prisma/client";

const ETIQUETAS: Record<EstadoPublicacion, string> = {
  pendiente: "En cola",
  publicando: "Publicando",
  publicada: "Publicada",
  fallida: "Fallida",
  cancelada: "Cancelada",
};

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
