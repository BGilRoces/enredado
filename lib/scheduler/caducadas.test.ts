import { describe, expect, it } from "vitest";
import { estaCaducada, VENTANA_GRACIA_MS } from "./caducadas";

const AHORA = new Date("2026-10-14T12:00:00Z");
const haceMs = (ms: number) => new Date(AHORA.getTime() - ms);

describe("estaCaducada", () => {
  it("sin programadaPara (publicar ahora) nunca caduca", () => {
    expect(estaCaducada(AHORA, null)).toBe(false);
  });

  it("futura o recién vencida: no caduca", () => {
    expect(estaCaducada(AHORA, new Date(AHORA.getTime() + 60_000))).toBe(false);
    expect(estaCaducada(AHORA, haceMs(5 * 60_000))).toBe(false);
  });

  it("justo en el límite de la ventana: todavía vale", () => {
    expect(estaCaducada(AHORA, haceMs(VENTANA_GRACIA_MS))).toBe(false);
  });

  it("pasada la ventana: caducada", () => {
    expect(estaCaducada(AHORA, haceMs(VENTANA_GRACIA_MS + 1))).toBe(true);
  });
});
