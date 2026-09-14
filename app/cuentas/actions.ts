"use server";

import { revalidatePath } from "next/cache";
import { EstadoCuenta } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * Desconecta una Cuenta: borra su token (ya no se puede publicar con ella)
 * pero conserva la fila y su historial de Publicaciones asociado.
 */
export async function desconectarCuenta(id: string) {
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
