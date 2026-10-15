import { EstadoIdea } from "@prisma/client";

export interface IdeaAtrasable {
  estado: EstadoIdea;
  programadaPara: Date | null;
  /** Ya la publicó el panel (historial anterior a ADR-0020). */
  yaPromocionada: boolean;
  programadaEnIgEl: Date | null;
}

/**
 * Función pura: una Idea calendarizada cuya hora ya pasó sin estar lista
 * (todavía no `enDrive`) o sin haberse programado en Instagram. Cálculo de UI
 * para avisarle a Bautista, no un estado guardado. El panel ya no publica
 * solo (ver ADR-0020), así que no hay ventana de gracia: pasada la hora, si
 * no se programó en IG, quedó atrasada.
 */
export function esAtrasada(ahora: Date, idea: IdeaAtrasable): boolean {
  if (!idea.programadaPara) return false;
  if (idea.yaPromocionada) return false;
  if (idea.programadaEnIgEl) return false;
  return idea.programadaPara <= ahora;
}
