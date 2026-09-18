import { EstadoPublicacion, TipoPublicacion, type Idea, type IdeaArchivo } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { MAX_ARCHIVOS_CAROUSEL } from "@/lib/publicador/limites";

/**
 * Crea la(s) Publicación(es) real(es) a partir de una Idea ya elegible (ver
 * ADR-0013, ADR-0016 y lib/ideas/decidir-ideas-para-promover.ts). De acá en
 * más el pipeline existente (Publicador/Cola/Scheduler) las controla sin
 * ningún cambio — se crean con `storageUrl`/`tipoMedia` en null, preparados
 * recién por `procesarUna` cuando les toque (ver ADR-0015).
 *
 * Tres formas, según cómo haya llegado a `enDrive`:
 * - Un solo archivo (`idea.driveFileId`, el caso original): una Publicación simple.
 * - Una carpeta con un solo archivo soportado: mismo resultado que el caso de arriba
 *   (un carousel de 1 elemento no tiene sentido, ni Instagram lo acepta).
 * - Una carpeta con 2+ archivos (ver ADR-0016): si es Post, un único carousel
 *   (`PublicacionArchivo` hijos, igual que ADR-0011); si es Historia, tantas
 *   Publicaciones independientes como archivos, creadas en orden — la cola
 *   secuencial existente (ADR-0005) ya las procesa una detrás de la otra.
 */
export async function promoverIdea(idea: Idea & { archivos: IdeaArchivo[] }): Promise<void> {
  const archivos = [...idea.archivos].sort((a, b) => a.orden - b.orden);
  const caption = idea.caption || idea.titulo;

  if (archivos.length === 0) {
    if (!idea.driveFileId) {
      throw new Error(`Idea ${idea.id} no tiene driveFileId ni archivos — no debería haber llegado acá (bug interno).`);
    }
    await prisma.publicacion.create({
      data: {
        cuentaId: idea.cuentaId,
        tipo: idea.tipo,
        driveFileId: idea.driveFileId,
        driveResourceKey: idea.driveResourceKey,
        caption,
        programadaPara: idea.programadaPara,
        estado: EstadoPublicacion.pendiente,
        ideaId: idea.id,
      },
    });
    return;
  }

  if (archivos.length === 1) {
    const [archivo] = archivos;
    await prisma.publicacion.create({
      data: {
        cuentaId: idea.cuentaId,
        tipo: idea.tipo,
        driveFileId: archivo.driveFileId,
        driveResourceKey: archivo.driveResourceKey,
        caption,
        programadaPara: idea.programadaPara,
        estado: EstadoPublicacion.pendiente,
        ideaId: idea.id,
      },
    });
    return;
  }

  if (idea.tipo === TipoPublicacion.post) {
    const elegidos = archivos.slice(0, MAX_ARCHIVOS_CAROUSEL);
    await prisma.publicacion.create({
      data: {
        cuentaId: idea.cuentaId,
        tipo: idea.tipo,
        caption,
        programadaPara: idea.programadaPara,
        estado: EstadoPublicacion.pendiente,
        ideaId: idea.id,
        archivos: {
          create: elegidos.map((archivo, orden) => ({
            orden,
            driveFileId: archivo.driveFileId,
            driveResourceKey: archivo.driveResourceKey,
          })),
        },
      },
    });
    return;
  }

  // Historia (o, defensivamente, Reel — aunque marcarEnDrive nunca deja
  // llegar un Reel con carpeta): Instagram no tiene carousel de Historias,
  // así que cada archivo es su propia Publicación (ver ADR-0011/0016).
  // Secuencial a propósito (no Promise.all), para que `creadaEn` refleje el
  // orden elegido — es el desempate que usa la cola (ver decidir-siguiente.ts).
  for (const archivo of archivos) {
    await prisma.publicacion.create({
      data: {
        cuentaId: idea.cuentaId,
        tipo: idea.tipo,
        driveFileId: archivo.driveFileId,
        driveResourceKey: archivo.driveResourceKey,
        caption,
        programadaPara: idea.programadaPara,
        estado: EstadoPublicacion.pendiente,
        ideaId: idea.id,
      },
    });
  }
}
