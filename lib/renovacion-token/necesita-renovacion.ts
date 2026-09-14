/**
 * Función pura: decide si el token de una Cuenta hay que renovarlo ya, dado
 * el momento actual, su vencimiento conocido, y el margen de anticipación
 * (los long-lived tokens de Meta duran ~60 días).
 */
export function necesitaRenovacion(
  ahora: Date,
  tokenExpiraEl: Date | null,
  margenMs: number
): boolean {
  if (!tokenExpiraEl) return false;
  return tokenExpiraEl.getTime() - ahora.getTime() <= margenMs;
}
