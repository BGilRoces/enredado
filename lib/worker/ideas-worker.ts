import { EstadoIdea } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { decidirIdeasParaPromover } from "@/lib/ideas/decidir-ideas-para-promover";
import { promoverIdea } from "@/lib/ideas/promover-idea";
import { tick as tickPublicador } from "@/lib/worker/publicador-worker";

/** Mismo intervalo que el resto del panel (ADR-0004) — no hace falta más frecuencia. */
const TICK_INTERVAL_MS = 2 * 60 * 1000;

let corriendo = false;

/**
 * Promociona las Ideas elegibles (ver ADR-0013) a Publicaciones reales.
 * Reentrante-seguro, mismo patrón que lib/worker/publicador-worker.ts y
 * lib/worker/token-renewal-worker.ts. No toca `decidirVencidas`/
 * `decidirSiguiente` del scheduler existente — es un feeder aparte que sólo
 * crea filas `pendiente` para que ese pipeline las procese como siempre.
 */
export async function tick(): Promise<void> {
  if (corriendo) return;
  corriendo = true;
  try {
    const candidatas = await prisma.idea.findMany({
      where: { estado: EstadoIdea.enDrive, publicaciones: { none: {} }, programadaPara: { not: null } },
      select: {
        id: true,
        estado: true,
        programadaPara: true,
        driveFileId: true,
        _count: { select: { archivos: true, publicaciones: true } },
      },
    });

    const promovibles = decidirIdeasParaPromover(
      new Date(),
      candidatas.map((idea) => ({
        id: idea.id,
        estado: idea.estado,
        programadaPara: idea.programadaPara,
        driveFileId: idea.driveFileId,
        tieneArchivos: idea._count.archivos > 0,
        yaPromocionada: idea._count.publicaciones > 0,
      }))
    );
    if (promovibles.length === 0) return;

    for (const id of promovibles) {
      const idea = await prisma.idea.findUnique({
        where: { id },
        include: { archivos: true, _count: { select: { publicaciones: true } } },
      });
      // Puede haberse descalendarizado/borrado entre el snapshot de arriba y acá.
      if (!idea || idea._count.publicaciones > 0 || idea.estado !== EstadoIdea.enDrive) continue;
      await promoverIdea(idea);
    }

    // No esperar hasta el próximo intervalo del publicador-worker para que
    // lo que se acaba de promover arranque a procesarse (mismo patrón que
    // crearPublicacion en app/publicar/actions.ts).
    await tickPublicador();
  } finally {
    corriendo = false;
  }
}

const globalForIdeasWorker = globalThis as unknown as { ideasWorkerStarted?: boolean };

/** Arranca el intervalo una sola vez por proceso — ver instrumentation.ts. */
export function startIdeasWorker(): void {
  if (globalForIdeasWorker.ideasWorkerStarted) return;
  globalForIdeasWorker.ideasWorkerStarted = true;
  setInterval(() => {
    tick().catch((error) => {
      console.error("[ideas-worker] tick falló:", error);
    });
  }, TICK_INTERVAL_MS);
}
