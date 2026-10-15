"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { asegurarAccesoACuenta } from "@/lib/auth/cuenta-permitida";

type Resultado = { ok: true } | { ok: false; error: string };

function revalidar() {
  revalidatePath("/cuentas");
  revalidatePath("/ideas");
  revalidatePath("/ideas/calendario");
  revalidatePath("/ideas/nueva");
  revalidatePath("/ideas/[id]", "page");
}

// Devuelven un resultado en vez de tirar: un throw en un Server Action llega
// al cliente con el mensaje pisado en producción (ver eliminarCuenta).

export async function crearProducto(cuentaId: string, nombre: string): Promise<Resultado> {
  await asegurarAccesoACuenta(cuentaId);
  const limpio = nombre.trim();
  if (!limpio) return { ok: false, error: "El nombre no puede estar vacío." };
  const existe = await prisma.producto.findUnique({ where: { cuentaId_nombre: { cuentaId, nombre: limpio } } });
  if (existe) return { ok: false, error: "Ya hay un producto con ese nombre en esta Cuenta." };
  await prisma.producto.create({ data: { cuentaId, nombre: limpio } });
  revalidar();
  return { ok: true };
}

export async function renombrarProducto(id: string, nombre: string): Promise<Resultado> {
  const producto = await prisma.producto.findUnique({ where: { id } });
  if (!producto) return { ok: false, error: "Producto no encontrado." };
  await asegurarAccesoACuenta(producto.cuentaId);
  const limpio = nombre.trim();
  if (!limpio) return { ok: false, error: "El nombre no puede estar vacío." };
  const repetido = await prisma.producto.findFirst({
    where: { cuentaId: producto.cuentaId, nombre: limpio, id: { not: id } },
  });
  if (repetido) return { ok: false, error: "Ya hay un producto con ese nombre en esta Cuenta." };
  await prisma.producto.update({ where: { id }, data: { nombre: limpio } });
  revalidar();
  return { ok: true };
}

/** Las Ideas del producto no se borran: pasan a "general" (onDelete: SetNull). */
export async function eliminarProducto(id: string): Promise<Resultado> {
  const producto = await prisma.producto.findUnique({ where: { id } });
  if (!producto) return { ok: false, error: "Producto no encontrado." };
  await asegurarAccesoACuenta(producto.cuentaId);
  await prisma.producto.delete({ where: { id } });
  revalidar();
  return { ok: true };
}
