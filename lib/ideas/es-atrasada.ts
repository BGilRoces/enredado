import { EstadoIdea } from "@prisma/client";

export interface IdeaAtrasable {
  estado: EstadoIdea;
  programadaPara: Date | null;
  publicacionId: string | null;
}

/**
 * Función pura (ver ADR-0013): una Idea calendarizada cuya hora ya pasó pero
 * que todavía no llegó a `enDrive` nunca se promociona sola (el worker de
 * promoción sólo mira `enDrive` — ver decidir-ideas-para-promover.ts). Esto
 * es un cálculo de UI para avisarle a Bautista, no un estado guardado. Una
 * vez promocionada (`publicacionId` seteado) ya no está "atrasada" — pasó a
 * ser una Publicación real, controlada por el pipeline existente.
 */
export function esAtrasada(ahora: Date, idea: IdeaAtrasable): boolean {
  if (!idea.programadaPara) return false;
  if (idea.publicacionId) return false;
  if (idea.estado === EstadoIdea.enDrive) return false;
  return idea.programadaPara <= ahora;
}
