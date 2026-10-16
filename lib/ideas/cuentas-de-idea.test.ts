import { describe, expect, it } from "vitest";
import { nombresCuentasIdea, whereCuentasIdea } from "./cuentas-de-idea";

describe("whereCuentasIdea", () => {
  it("sin filtro no restringe", () => {
    expect(whereCuentasIdea(null)).toEqual({});
  });

  it("matchea por Cuenta principal o colaboradora, dentro de AND", () => {
    expect(whereCuentasIdea(["a", "b"])).toEqual({
      AND: [{ OR: [{ cuentaId: { in: ["a", "b"] } }, { colaboradoras: { some: { id: { in: ["a", "b"] } } } }] }],
    });
  });
});

describe("nombresCuentasIdea", () => {
  it("une la principal con las colaboradoras", () => {
    expect(nombresCuentasIdea({ cuenta: { nombre: "A" }, colaboradoras: [{ nombre: "B" }, { nombre: "C" }] })).toBe(
      "A + B + C",
    );
  });

  it("sin colaboradoras es sólo la principal", () => {
    expect(nombresCuentasIdea({ cuenta: { nombre: "A" } })).toBe("A");
  });
});
