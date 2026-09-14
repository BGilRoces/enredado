import { describe, expect, it } from "vitest";
import { decidirVencidas } from "./decidir-vencidas";

const AHORA = new Date("2026-09-14T12:00:00Z");

describe("decidirVencidas", () => {
  it("una Publicación sin programadaPara (inmediata) siempre está vencida", () => {
    const resultado = decidirVencidas(AHORA, [{ id: "a", programadaPara: null }]);
    expect(resultado).toEqual(["a"]);
  });

  it("una Publicación programada para el pasado está vencida", () => {
    const resultado = decidirVencidas(AHORA, [
      { id: "a", programadaPara: new Date("2026-09-14T11:59:00Z") },
    ]);
    expect(resultado).toEqual(["a"]);
  });

  it("una Publicación programada para exactamente ahora está vencida", () => {
    const resultado = decidirVencidas(AHORA, [{ id: "a", programadaPara: AHORA }]);
    expect(resultado).toEqual(["a"]);
  });

  it("una Publicación programada para el futuro no está vencida", () => {
    const resultado = decidirVencidas(AHORA, [
      { id: "a", programadaPara: new Date("2026-09-14T12:01:00Z") },
    ]);
    expect(resultado).toEqual([]);
  });

  it("preserva el orden de entrada, filtrando solo las vencidas", () => {
    const resultado = decidirVencidas(AHORA, [
      { id: "futura", programadaPara: new Date("2026-09-15T00:00:00Z") },
      { id: "inmediata", programadaPara: null },
      { id: "pasada", programadaPara: new Date("2026-09-01T00:00:00Z") },
    ]);
    expect(resultado).toEqual(["inmediata", "pasada"]);
  });

  it("lista vacía no rompe", () => {
    expect(decidirVencidas(AHORA, [])).toEqual([]);
  });
});
