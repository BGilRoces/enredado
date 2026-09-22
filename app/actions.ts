"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { asegurarAccesoACuenta } from "@/lib/auth/cuenta-permitida";

/**
 * Descarta la alerta de "Necesita atención" de una Cuenta sin tocar su
 * `estado` — para cuando el dueño ya la reconectó por su cuenta y el panel
 * todavía no lo reflejó. Vuelve a aparecer sola si la Cuenta cae de nuevo en
 * `necesitaReconexion` (ver lib/worker/token-renewal-worker.ts).
 */
export async function descartarAlertaCuenta(id: string): Promise<void> {
  await asegurarAccesoACuenta(id);
  await prisma.cuenta.update({ where: { id }, data: { alertaDescartada: true } });
  revalidatePath("/");
}

/** Descarta la alerta de una Publicación fallida — es terminal, así que el descarte es definitivo. */
export async function descartarAlertaPublicacion(id: string): Promise<void> {
  const publicacion = await prisma.publicacion.findUnique({ where: { id }, select: { cuentaId: true } });
  if (!publicacion) throw new Error("Publicación no encontrada.");
  await asegurarAccesoACuenta(publicacion.cuentaId);
  await prisma.publicacion.update({ where: { id }, data: { alertaDescartada: true } });
  revalidatePath("/");
}
