"use server";

import { revalidatePath } from "next/cache";
import { EstadoCuenta, EstadoPublicacion } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { asegurarAccesoACuenta, obtenerCuentaIdPermitida } from "@/lib/auth/cuenta-permitida";
import { redirect } from "next/navigation";

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
 * Una Publicación `cancelada` sólo se llega a ese estado desde `pendiente`
 * (ver cancelarPublicacion en app/publicar/actions.ts) — nunca salió por
 * Meta, así que no es "historial" real. Sin excluirla acá, borrar una Idea
 * con una Publicación pendiente (eliminarIdea la cancela pero no la borra,
 * y su ideaId queda en null por el onDelete: SetNull del schema) dejaba una
 * fila fantasma que bloqueaba el borrado de la Cuenta para siempre, sin
 * forma de sacarla desde la UI.
 *
 * Devuelve un resultado en vez de tirar para los casos esperados: un `throw`
 * en un Server Action se manda al cliente con el mensaje pisado por Next en
 * producción (el genérico "Minified React error #441"), así que la validación
 * nunca se vería.
 */
export async function eliminarCuenta(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await asegurarAccesoACuenta(id);
  const cuenta = await prisma.cuenta.findUniqueOrThrow({ where: { id } });
  const esManual = cuenta.estado === EstadoCuenta.conectada && !cuenta.accessTokenEncriptado;
  if (cuenta.estado !== EstadoCuenta.desconectada && !esManual) {
    return { ok: false, error: "Sólo se pueden eliminar Cuentas desconectadas o manuales." };
  }

  const [publicaciones, ideas] = await Promise.all([
    prisma.publicacion.count({
      where: { cuentaId: id, estado: { not: EstadoPublicacion.cancelada } },
    }),
    prisma.idea.count({ where: { cuentaId: id } }),
  ]);
  if (publicaciones > 0 || ideas > 0) {
    return { ok: false, error: "Esta Cuenta tiene Publicaciones o Ideas asociadas, no se puede eliminar." };
  }

  await prisma.cuenta.delete({ where: { id } });
  revalidatePath("/cuentas");
  return { ok: true };
}

/**
 * Alta de una Cuenta "manual": sin OAuth con Meta ni token, porque el panel ya
 * no publica en Instagram (se programa a mano en la app). `igUserId` es
 * @unique, así que se rellena con un id sintético que no puede chocar con uno
 * real de Meta (numérico). Una Cuenta conectada sin token es "manual".
 * Va por redirect con `?error=` (como el callback de Meta) en vez de tirar,
 * por el mismo motivo que eliminarCuenta.
 */
export async function crearCuentaManual(formData: FormData) {
  if (await obtenerCuentaIdPermitida()) {
    redirect("/cuentas?error=" + encodeURIComponent("No tenés permiso para agregar Cuentas."));
  }
  const nombre = String(formData.get("nombre") ?? "").trim();
  const igUsername = String(formData.get("igUsername") ?? "").trim().replace(/^@/, "");
  if (!nombre) {
    redirect("/cuentas?error=" + encodeURIComponent("El nombre no puede estar vacío."));
  }
  await prisma.cuenta.create({
    data: {
      nombre,
      igUsername: igUsername || nombre,
      igUserId: `manual-${crypto.randomUUID()}`,
      estado: EstadoCuenta.conectada,
    },
  });
  revalidatePath("/cuentas");
  revalidatePath("/ideas/nueva");
  redirect("/cuentas");
}
