import { describe, expect, it } from "vitest";
import { tituloDesdeCaption } from "./titulo-desde-caption";

describe("tituloDesdeCaption", () => {
  it("usa la primera línea no vacía", () => {
    expect(tituloDesdeCaption("\n  Guantes: ¿de cuántas onzas?  \nwww.saume.com.ar", "x")).toBe(
      "Guantes: ¿de cuántas onzas?"
    );
  });

  it("recorta una primera línea larga", () => {
    const titulo = tituloDesdeCaption("a".repeat(200), "x");
    expect(titulo).toHaveLength(80);
    expect(titulo.endsWith("…")).toBe(true);
  });

  it("sin caption usa el respaldo", () => {
    expect(tituloDesdeCaption(null, "Post sin título")).toBe("Post sin título");
    expect(tituloDesdeCaption("  \n ", "Post sin título")).toBe("Post sin título");
  });
});
