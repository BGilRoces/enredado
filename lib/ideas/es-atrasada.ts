import { EstadoIdea } from "@prisma/client";

export interface IdeaAtrasable {
  estado: EstadoIdea;
  programadaPara: Date | null;
  yaPromocionada: boolean;
}

/**
 * Función pura (ver ADR-0013): una Idea calendarizada cuya hora ya pasó pero
 * que todavía no llegó a `enDrive` nunca se promociona sola (el worker de
 * promoción sólo mira `enDrive` — ver decidir-ideas-para-promover.ts). Esto
 * es un cálculo de UI para avisarle a Bautista, no un estado guardado. Una
 * vez promocionada ya no está "atrasada" — pasó a ser una o más
 * Publicaciones reales, controladas por el pipeline existente (ver ADR-0016).
 */
export function esAtrasada(ahora: Date, idea: IdeaAtrasable): boolean {
  if (!idea.programadaPara) return false;
  if (idea.yaPromocionada) return false;
  if (idea.estado === EstadoIdea.enDrive) return false;
  return idea.programadaPara <= ahora;
}
