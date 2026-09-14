export interface PublicacionPendiente {
  id: string;
  /** Nulo = inmediata (ver ADR-0009), siempre vencida. */
  programadaPara: Date | null;
}

/**
 * Función pura (ADR-0004): dado el momento actual y las Publicaciones
 * pendientes (en el orden en que deben procesarse si empatan), devuelve los
 * ids de las que ya vencieron — nulas o con programadaPara <= ahora.
 */
export function decidirVencidas(ahora: Date, pendientes: PublicacionPendiente[]): string[] {
  return pendientes
    .filter((p) => p.programadaPara === null || p.programadaPara <= ahora)
    .map((p) => p.id);
}
