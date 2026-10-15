import { EstadoIdea } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { esAtrasada } from "./es-atrasada";

const AHORA = new Date("2026-09-17T12:00:00Z");
const PASADO = new Date("2026-09-17T11:00:00Z");
const FUTURO = new Date("2026-09-17T13:00:00Z");

const base = { estado: EstadoIdea.enDrive, programadaPara: PASADO, yaPromocionada: false, programadaEnIgEl: null };

describe("esAtrasada", () => {
  it("sin programadaPara: nunca atrasada", () => {
    expect(esAtrasada(AHORA, { ...base, estado: EstadoIdea.idea, programadaPara: null })).toBe(false);
  });

  it("hora pasada sin estar enDrive: atrasada", () => {
    expect(esAtrasada(AHORA, { ...base, estado: EstadoIdea.grabada })).toBe(true);
  });

  it("enDrive con hora pasada y sin programar en IG: atrasada", () => {
    expect(esAtrasada(AHORA, base)).toBe(true);
  });

  it("enDrive con hora pasada pero ya programada en IG: no atrasada", () => {
    expect(esAtrasada(AHORA, { ...base, programadaEnIgEl: new Date("2026-09-10T00:00:00Z") })).toBe(false);
  });

  it("hora futura: no atrasada", () => {
    expect(esAtrasada(AHORA, { ...base, programadaPara: FUTURO })).toBe(false);
  });

  it("ya publicada por el panel: no atrasada", () => {
    expect(esAtrasada(AHORA, { ...base, yaPromocionada: true })).toBe(false);
  });
});
