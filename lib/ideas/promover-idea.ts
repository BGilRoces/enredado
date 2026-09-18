import { EstadoPublicacion, type Idea } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * Crea la Publicación real a partir de una Idea ya elegible (ver ADR-0013 y
 * lib/ideas/decidir-ideas-para-promover.ts) y la deja linkeada. De acá en
 * más el pipeline existente (Publicador/Cola/Scheduler) la controla sin
 * ningún cambio — se crea con `storageUrl`/`tipoMedia` en null, preparados
 * recién por `procesarUna` cuando le toque (ver ADR-0015).
 */
export async function promoverIdea(idea: Idea): Promise<void> {
  if (!idea.driveFileId) {
    throw new Error(`Idea ${idea.id} no tiene driveFileId — no debería haber llegado acá (bug interno).`);
  }

  const publicacion = await prisma.publicacion.create({
    data: {
      cuentaId: idea.cuentaId,
      tipo: idea.tipo,
      driveFileId: idea.driveFileId,
      caption: idea.caption || idea.titulo,
      programadaPara: idea.programadaPara,
      estado: EstadoPublicacion.pendiente,
    },
  });

  await prisma.idea.update({
    where: { id: idea.id },
    data: { publicacionId: publicacion.id },
  });
}
