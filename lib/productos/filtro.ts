import type { Prisma } from "@prisma/client";
import { parsearSeleccionMultiple } from "@/lib/parsear-seleccion-multiple";

/** Valor del filtro para las Ideas sin producto (de marca). */
export const PRODUCTO_GENERAL = "general";

/**
 * `null` = sin filtro. Un id de Producto que ya no aplica (ej.: el usuario
 * destildó la Cuenta a la que pertenecía) se descarta; si no queda ninguno
 * válido se vuelve a "todos" en vez de dejar la lista vacía sin explicación.
 */
export function parsearFiltroProductos(
  valor: string | string[] | undefined,
  validos: readonly string[],
): string[] | null {
  const crudo = Array.isArray(valor) ? valor[0] : valor;
  const seleccion = parsearSeleccionMultiple(valor, validos);
  if (seleccion !== null && seleccion.length === 0 && crudo !== "") return null;
  return seleccion;
}

export function whereProducto(seleccion: string[] | null): Prisma.IdeaWhereInput {
  if (seleccion === null) return {};
  const ids = seleccion.filter((valor) => valor !== PRODUCTO_GENERAL);
  const OR: Prisma.IdeaWhereInput[] = [];
  if (ids.length > 0) OR.push({ productoId: { in: ids } });
  if (seleccion.includes(PRODUCTO_GENERAL)) OR.push({ productoId: null });
  // Selección vacía a propósito ("Ninguna"): no matchea nada.
  return OR.length > 0 ? { OR } : { productoId: { in: [] } };
}

export interface OpcionProducto {
  value: string;
  label: string;
}

/**
 * Opciones del filtro: "General" primero y después los Productos. Sin
 * productos en las Cuentas visibles (ej.: sólo Tropero) no hay nada que
 * filtrar, así que no se ofrece nada. Con productos de más de una Cuenta,
 * el nombre lleva el de la Cuenta para distinguirlos.
 */
export function opcionesProducto(
  productos: { id: string; nombre: string; cuenta: { nombre: string } }[],
): OpcionProducto[] {
  if (productos.length === 0) return [];
  const variasCuentas = new Set(productos.map((p) => p.cuenta.nombre)).size > 1;
  return [
    { value: PRODUCTO_GENERAL, label: "General (marca)" },
    ...productos.map((p) => ({ value: p.id, label: variasCuentas ? `${p.cuenta.nombre} · ${p.nombre}` : p.nombre })),
  ];
}
