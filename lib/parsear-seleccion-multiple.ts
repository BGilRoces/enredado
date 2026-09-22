/** Parsea el valor crudo de un searchParam multi-valor: `null` = "todas". */
export function parsearSeleccionMultiple<T extends string>(
  valor: string | string[] | undefined,
  valoresValidos: readonly T[],
): T[] | null {
  if (valor === undefined) return null;
  const crudo = Array.isArray(valor) ? valor[0] : valor;
  if (crudo === "") return [];
  const validos = new Set<string>(valoresValidos);
  return crudo.split(",").filter((v): v is T => validos.has(v));
}
