"use server";

import { revalidatePath } from "next/cache";
import { EstadoCuenta, EstadoPublicacion, TipoPublicacion } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { decryptToken } from "@/lib/crypto/token-cipher";
import { publicar } from "@/lib/publicador/publicar";
import { esperarMs } from "@/lib/publicador/esperar";
import type { ResultadoPublicacion } from "@/lib/publicador/types";
import { driveClient } from "@/lib/drive/client";
import { storageClient } from "@/lib/storage/client";
import { metaPublishClient } from "@/lib/meta/client";

export interface PublicarEnInstagramInput {
  cuentaId: string;
  driveFileId: string;
  driveAccessToken: string;
  tipoPublicacion: TipoPublicacion;
  caption: string;
}

/**
 * Orquesta el Publicador para una Publicación inmediata: resuelve la Cuenta,
 * registra la Publicación como "publicando" antes de intentar nada, y
 * actualiza su resultado final — así el registro no depende de que el
 * proceso no se caiga a mitad de camino.
 */
export async function publicarEnInstagram(
  input: PublicarEnInstagramInput
): Promise<ResultadoPublicacion> {
  const cuenta = await prisma.cuenta.findUnique({ where: { id: input.cuentaId } });
  if (!cuenta || cuenta.estado !== EstadoCuenta.conectada || !cuenta.accessTokenEncriptado) {
    throw new Error("La Cuenta elegida no está conectada.");
  }

  const publicacion = await prisma.publicacion.create({
    data: {
      cuentaId: cuenta.id,
      tipo: input.tipoPublicacion,
      driveFileId: input.driveFileId,
      caption: input.caption || null,
    },
  });

  const resultado = await publicar(
    {
      driveFileId: input.driveFileId,
      driveAccessToken: input.driveAccessToken,
      tipoPublicacion: input.tipoPublicacion,
      caption: input.caption || undefined,
      cuenta: {
        igUserId: cuenta.igUserId,
        accessToken: decryptToken(cuenta.accessTokenEncriptado),
      },
    },
    { drive: driveClient, storage: storageClient, meta: metaPublishClient, esperar: esperarMs }
  );

  await prisma.publicacion.update({
    where: { id: publicacion.id },
    data:
      resultado.estado === EstadoPublicacion.publicada
        ? { estado: EstadoPublicacion.publicada, metaMediaId: resultado.metaMediaId }
        : { estado: EstadoPublicacion.fallida, error: resultado.error },
  });

  revalidatePath("/publicar");
  return resultado;
}
