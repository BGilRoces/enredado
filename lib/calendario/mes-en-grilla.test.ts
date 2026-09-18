import { describe, expect, it } from "vitest";
import { mesEnGrilla } from "./mes-en-grilla";

describe("mesEnGrilla", () => {
  it("siempre devuelve 42 días (6 semanas)", () => {
    expect(mesEnGrilla(2026, 9).length).toBe(42);
  });

  it("el primer día de la grilla siempre es lunes", () => {
    for (const [anio, mes] of [
      [2026, 1],
      [2026, 2],
      [2026, 9],
      [2027, 12],
    ]) {
      const [primero] = mesEnGrilla(anio, mes);
      expect(primero.fecha.getUTCDay()).toBe(1);
    }
  });

  it("septiembre 2026 (arranca martes 1): incluye lunes 31 de agosto como relleno", () => {
    const dias = mesEnGrilla(2026, 9);
    expect(dias[0].fecha.toISOString().slice(0, 10)).toBe("2026-08-31");
    expect(dias[0].delMesActual).toBe(false);
    const primerDiaReal = dias.find((d) => d.fecha.toISOString().slice(0, 10) === "2026-09-01");
    expect(primerDiaReal?.delMesActual).toBe(true);
  });

  it("incluye el último día del mes marcado como delMesActual", () => {
    const dias = mesEnGrilla(2026, 9);
    const ultimoDia = dias.find((d) => d.fecha.toISOString().slice(0, 10) === "2026-09-30");
    expect(ultimoDia?.delMesActual).toBe(true);
  });

  it("febrero de año bisiesto (2028): incluye el 29", () => {
    const dias = mesEnGrilla(2028, 2);
    const dia29 = dias.find((d) => d.fecha.toISOString().slice(0, 10) === "2028-02-29");
    expect(dia29?.delMesActual).toBe(true);
  });

  it("diciembre (cruza a enero del año siguiente en el relleno final)", () => {
    const dias = mesEnGrilla(2026, 12);
    const ultimo = dias[dias.length - 1];
    expect(ultimo.fecha.getUTCFullYear()).toBeGreaterThanOrEqual(2026);
  });
});
