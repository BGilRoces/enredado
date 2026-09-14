import { describe, expect, it } from "vitest";
import { necesitaRenovacion } from "./necesita-renovacion";

const AHORA = new Date("2026-09-14T12:00:00Z");
const MARGEN_7_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

describe("necesitaRenovacion", () => {
  it("token ya vencido: necesita renovarse", () => {
    expect(necesitaRenovacion(AHORA, new Date("2026-09-01T00:00:00Z"), MARGEN_7_DIAS_MS)).toBe(true);
  });

  it("token que vence mañana (dentro del margen de 7 días): necesita renovarse", () => {
    expect(necesitaRenovacion(AHORA, new Date("2026-09-15T00:00:00Z"), MARGEN_7_DIAS_MS)).toBe(true);
  });

  it("token que vence justo en el borde del margen: necesita renovarse", () => {
    const bordeExacto = new Date(AHORA.getTime() + MARGEN_7_DIAS_MS);
    expect(necesitaRenovacion(AHORA, bordeExacto, MARGEN_7_DIAS_MS)).toBe(true);
  });

  it("token que vence en 30 días (fuera del margen de 7 días): todavía no", () => {
    expect(necesitaRenovacion(AHORA, new Date("2026-10-14T12:00:00Z"), MARGEN_7_DIAS_MS)).toBe(false);
  });

  it("sin fecha de vencimiento conocida: no fuerza nada", () => {
    expect(necesitaRenovacion(AHORA, null, MARGEN_7_DIAS_MS)).toBe(false);
  });
});
