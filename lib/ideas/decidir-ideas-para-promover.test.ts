import { EstadoIdea } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { decidirIdeasParaPromover, type IdeaPromovible } from "./decidir-ideas-para-promover";

const AHORA = new Date("2026-09-17T12:00:00Z");

function idea(overrides: Partial<IdeaPromovible> = {}): IdeaPromovible {
  return {
    id: "idea-1",
    estado: EstadoIdea.enDrive,
    programadaPara: new Date("2026-09-17T11:00:00Z"),
    driveFileId: "drive-1",
    tieneArchivos: false,
    yaPromocionada: false,
    ...overrides,
  };
}

describe("decidirIdeasParaPromover", () => {
  it("enDrive, con archivo y hora cumplida: elegible", () => {
    expect(decidirIdeasParaPromover(AHORA, [idea()])).toEqual(["idea-1"]);
  });

  it("enDrive con carpeta (tieneArchivos) en vez de driveFileId: también elegible", () => {
    expect(
      decidirIdeasParaPromover(AHORA, [idea({ driveFileId: null, tieneArchivos: true })])
    ).toEqual(["idea-1"]);
  });

  it("no enDrive (ej. grabada) aunque tenga fecha pasada: no elegible", () => {
    expect(decidirIdeasParaPromover(AHORA, [idea({ estado: EstadoIdea.grabada })])).toEqual([]);
  });

  it("enDrive pero sin programadaPara (nunca se calendarizó): no elegible", () => {
    expect(decidirIdeasParaPromover(AHORA, [idea({ programadaPara: null })])).toEqual([]);
  });

  it("enDrive, programada, pero para el futuro: no elegible todavía", () => {
    expect(
      decidirIdeasParaPromover(AHORA, [idea({ programadaPara: new Date("2026-09-17T13:00:00Z") })])
    ).toEqual([]);
  });

  it("enDrive sin driveFileId resuelto ni archivos (bug/estado inconsistente): no elegible", () => {
    expect(decidirIdeasParaPromover(AHORA, [idea({ driveFileId: null, tieneArchivos: false })])).toEqual([]);
  });

  it("ya promocionada: no se promueve de nuevo", () => {
    expect(decidirIdeasParaPromover(AHORA, [idea({ yaPromocionada: true })])).toEqual([]);
  });

  it("lista vacía no rompe", () => {
    expect(decidirIdeasParaPromover(AHORA, [])).toEqual([]);
  });
});
