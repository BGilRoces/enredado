import { EstadoIdea } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { esAtrasada } from "./es-atrasada";

const AHORA = new Date("2026-09-17T12:00:00Z");

describe("esAtrasada", () => {
  it("sin programadaPara: nunca atrasada", () => {
    expect(esAtrasada(AHORA, { estado: EstadoIdea.idea, programadaPara: null, publicacionId: null })).toBe(
      false
    );
  });

  it("programada para el pasado, sin enDrive: atrasada", () => {
    expect(
      esAtrasada(AHORA, {
        estado: EstadoIdea.grabada,
        programadaPara: new Date("2026-09-17T11:00:00Z"),
        publicacionId: null,
      })
    ).toBe(true);
  });

  it("programada para el pasado, pero enDrive: no atrasada (ya elegible para promoverse)", () => {
    expect(
      esAtrasada(AHORA, {
        estado: EstadoIdea.enDrive,
        programadaPara: new Date("2026-09-17T11:00:00Z"),
        publicacionId: null,
      })
    ).toBe(false);
  });

  it("programada para el futuro: no atrasada", () => {
    expect(
      esAtrasada(AHORA, {
        estado: EstadoIdea.grabada,
        programadaPara: new Date("2026-09-17T13:00:00Z"),
        publicacionId: null,
      })
    ).toBe(false);
  });

  it("ya promocionada (publicacionId seteado): no atrasada, aunque el estado siga sin enDrive", () => {
    expect(
      esAtrasada(AHORA, {
        estado: EstadoIdea.grabada,
        programadaPara: new Date("2026-09-17T11:00:00Z"),
        publicacionId: "pub-1",
      })
    ).toBe(false);
  });
});
