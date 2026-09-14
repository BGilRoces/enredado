/**
 * Función pura (ADR-0005): dado si ya hay una Publicación en curso y la lista
 * de vencidas (en el orden en que deben procesarse), decide cuál sigue.
 * Nunca deja avanzar dos a la vez.
 */
export function decidirSiguiente(hayUnaEnCurso: boolean, vencidas: string[]): string | null {
  if (hayUnaEnCurso) return null;
  return vencidas[0] ?? null;
}
