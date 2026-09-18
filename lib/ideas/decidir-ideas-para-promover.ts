import { EstadoIdea } from "@prisma/client";

export interface IdeaPromovible {
  id: string;
  estado: EstadoIdea;
  programadaPara: Date | null;
  driveFileId: string | null;
  /** Al menos un archivo en su carpeta (ver ADR-0016) — alternativa a driveFileId para el caso simple. */
  tieneArchivos: boolean;
  /** Ya tiene alguna Publicación vinculada (ver ADR-0013) — no es un booleano derivado de un solo id: una Idea puede promocionar a varias (ADR-0016). */
  yaPromocionada: boolean;
}

/**
 * Función pura (ver ADR-0013): dado el momento actual y las Ideas candidatas
 * (todavía no promocionadas), devuelve los ids de las que ya son elegibles
 * para convertirse en una Publicación real — `enDrive`, con el archivo (o la
 * carpeta) resuelto, y la hora ya cumplida. Una Idea sin `programadaPara`
 * nunca se promueve sola (no hay "ahora" implícito para una Idea, a
 * diferencia de una Publicación creada desde /publicar — ver decidir-vencidas.ts).
 */
export function decidirIdeasParaPromover(ahora: Date, candidatas: IdeaPromovible[]): string[] {
  return candidatas
    .filter(
      (idea) =>
        !idea.yaPromocionada &&
        idea.estado === EstadoIdea.enDrive &&
        (idea.driveFileId !== null || idea.tieneArchivos) &&
        idea.programadaPara !== null &&
        idea.programadaPara <= ahora
    )
    .map((idea) => idea.id);
}
