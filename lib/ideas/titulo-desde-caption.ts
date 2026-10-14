const MAX_LARGO = 80;

/**
 * Las Publicaciones que nacen en /publicar no piden título (ver ADR-0019),
 * pero toda Idea necesita uno: se usa la primera línea no vacía del caption,
 * recortada, o un texto genérico si no hay caption.
 */
export function tituloDesdeCaption(caption: string | null | undefined, respaldo: string): string {
  const primeraLinea = (caption ?? "")
    .split("\n")
    .map((linea) => linea.trim())
    .find((linea) => linea.length > 0);
  if (!primeraLinea) return respaldo;
  if (primeraLinea.length <= MAX_LARGO) return primeraLinea;
  return `${primeraLinea.slice(0, MAX_LARGO - 1).trimEnd()}…`;
}
