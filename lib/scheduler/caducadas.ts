/**
 * Cuánto después de su hora programada una Publicación (o una Idea lista para
 * promocionarse) sigue siendo válida para salir sola — ver ADR-0018. Tiene que
 * cubrir la cola secuencial (ADR-0005: ~decenas de elementos programados a la
 * misma hora) pero no dejar que el panel publique algo viejo después de una
 * caída o un error: pasado este margen se descarta en vez de publicarse tarde.
 */
export const VENTANA_GRACIA_MS = 2 * 60 * 60 * 1000;

/** Función pura: sin `programadaPara` ("ahora", ver ADR-0009) nunca caduca. */
export function estaCaducada(ahora: Date, programadaPara: Date | null): boolean {
  if (!programadaPara) return false;
  return ahora.getTime() - programadaPara.getTime() > VENTANA_GRACIA_MS;
}
