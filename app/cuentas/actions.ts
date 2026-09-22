"use server";

import { revalidatePath } from "next/cache";
import { EstadoCuenta } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { asegurarAccesoACuenta } from "@/lib/auth/cuenta-permitida";

/**
 * Desconecta una Cuenta: borra su token (ya no se puede publicar con ella)
 * pero conserva la fila y su historial de Publicaciones asociado.
 */
export async function desconectarCuenta(id: string) {
  await asegurarAccesoACuenta(id);
  await prisma.cuenta.update({
    where: { id },
    data: {
      estado: EstadoCuenta.desconectada,
      accessTokenEncriptado: null,
      tokenExpiraEl: null,
    },
  });
  revalidatePath("/cuentas");
}

/**
 * Elimina de verdad una Cuenta desconectada (no un Publicación/Idea, esas
 * conservan su historial) — pensado para las filas "fantasma" que quedan
 * cuando reconectar una cuenta crea una fila nueva en vez de reusar la vieja.
 * Sólo permitido si está desconectada y sin Publicaciones/Ideas asociadas,
 * para no perder historial ni romper una fila que sigue en uso.
 *
 * Devuelve un resultado en vez de tirar para los casos esperados: un `throw`
 * en un Server Action se manda al cliente con el mensaje pisado por Next en
 * producción (el genérico "Minified React error #441"), así que la validación
 * nunca se vería.
 */
export async function eliminarCuenta(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await asegurarAccesoACuenta(id);
  const cuenta = await prisma.cuenta.findUniqueOrThrow({ where: { id } });
  if (cuenta.estado !== EstadoCuenta.desconectada) {
    return { ok: false, error: "Sólo se pueden eliminar Cuentas desconectadas." };
  }

  const [publicaciones, ideas] = await Promise.all([
    prisma.publicacion.count({ where: { cuentaId: id } }),
    prisma.idea.count({ where: { cuentaId: id } }),
  ]);
  if (publicaciones > 0 || ideas > 0) {
    return { ok: false, error: "Esta Cuenta tiene Publicaciones o Ideas asociadas, no se puede eliminar." };
  }

  await prisma.cuenta.delete({ where: { id } });
  revalidatePath("/cuentas");
  return { ok: true };
}
