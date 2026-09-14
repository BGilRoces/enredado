import { describe, expect, it } from "vitest";
import { decidirSiguiente } from "./decidir-siguiente";

describe("decidirSiguiente", () => {
  it("si no hay ninguna en curso, sigue la primera vencida", () => {
    expect(decidirSiguiente(false, ["a", "b"])).toBe("a");
  });

  it("si ya hay una en curso, no deja avanzar otra (nunca en paralelo, ADR-0005)", () => {
    expect(decidirSiguiente(true, ["a", "b"])).toBeNull();
  });

  it("sin vencidas, no hay nada que hacer aunque no haya ninguna en curso", () => {
    expect(decidirSiguiente(false, [])).toBeNull();
  });

  it("si dos vencen al mismo tiempo, respeta el orden de la lista (una por una)", () => {
    // decidirVencidas ya las entrega en el orden en que deben procesarse;
    // acá solo se verifica que la Cola arranca por la primera y no por otra.
    expect(decidirSiguiente(false, ["primera", "segunda", "tercera"])).toBe("primera");
  });
});
