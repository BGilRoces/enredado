import { EstadoIdea } from "@prisma/client";
import { estaCaducada } from "@/lib/scheduler/caducadas";

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
 * Una Idea `enDrive` sólo está atrasada si su hora caducó (ADR-0018): antes
 * de eso el worker todavía la va a promocionar en el próximo tick.
 */
export function esAtrasada(ahora: Date, idea: IdeaAtrasable): boolean {
  if (!idea.programadaPara) return false;
  if (idea.yaPromocionada) return false;
  if (idea.estado === EstadoIdea.enDrive) return estaCaducada(ahora, idea.programadaPara);
  return idea.programadaPara <= ahora;
}
