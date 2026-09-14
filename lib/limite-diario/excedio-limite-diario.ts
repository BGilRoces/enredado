/** Documentado por Meta como tope por Cuenta — ver GET /{ig-user-id}/content_publishing_limit para el uso real. */
export const LIMITE_PUBLICACIONES_POR_VENTANA = 50;
export const VENTANA_LIMITE_MS = 24 * 60 * 60 * 1000;

/**
 * Instagram cuenta las Publicaciones exitosas en una ventana MÓVIL de 24hs
 * (no un día de calendario: la capacidad se libera 24hs después de cada
 * publicación, no a medianoche) — si ya se alcanzó el límite dentro de esa
 * ventana, ni conviene intentarlo contra la Graph API.
 */
export function excedioLimiteDiario(
  ahora: Date,
  publicadasRecientes: Date[],
  limite: number = LIMITE_PUBLICACIONES_POR_VENTANA,
  ventanaMs: number = VENTANA_LIMITE_MS
): boolean {
  const desde = ahora.getTime() - ventanaMs;
  const enVentana = publicadasRecientes.filter(
    (fecha) => fecha.getTime() > desde && fecha.getTime() <= ahora.getTime()
  );
  return enVentana.length >= limite;
}
