import { describe, expect, it } from "vitest";
import { excedioLimiteDiario } from "./excedio-limite-diario";

const AHORA = new Date("2026-09-14T12:00:00Z");
const LIMITE = 3;
const VENTANA_24H_MS = 24 * 60 * 60 * 1000;

function hace(horas: number): Date {
  return new Date(AHORA.getTime() - horas * 60 * 60 * 1000);
}

describe("excedioLimiteDiario", () => {
  it("sin Publicaciones recientes, no excede", () => {
    expect(excedioLimiteDiario(AHORA, [], LIMITE, VENTANA_24H_MS)).toBe(false);
  });

  it("con una menos que el límite dentro de la ventana, no excede", () => {
    const publicadas = [hace(1), hace(2)];
    expect(excedioLimiteDiario(AHORA, publicadas, LIMITE, VENTANA_24H_MS)).toBe(false);
  });

  it("con exactamente el límite dentro de la ventana, excede", () => {
    const publicadas = [hace(1), hace(2), hace(3)];
    expect(excedioLimiteDiario(AHORA, publicadas, LIMITE, VENTANA_24H_MS)).toBe(true);
  });

  it("una Publicación justo en el borde de la ventana (exactamente 24hs atrás) ya no cuenta", () => {
    const publicadas = [hace(24), hace(1), hace(2)];
    expect(excedioLimiteDiario(AHORA, publicadas, LIMITE, VENTANA_24H_MS)).toBe(false);
  });

  it("Publicaciones viejas (fuera de la ventana móvil) no cuentan aunque haya muchas", () => {
    const publicadas = [hace(25), hace(30), hace(48), hace(100)];
    expect(excedioLimiteDiario(AHORA, publicadas, LIMITE, VENTANA_24H_MS)).toBe(false);
  });

  it("ventana móvil, no día de calendario: mezcla de viejas y recientes cuenta solo las recientes", () => {
    const publicadas = [hace(25), hace(23), hace(10), hace(1)];
    // hace(23), hace(10) y hace(1) están dentro de la ventana -> 3 = límite -> excede
    expect(excedioLimiteDiario(AHORA, publicadas, LIMITE, VENTANA_24H_MS)).toBe(true);
  });
});
