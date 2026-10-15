import { describe, expect, it } from "vitest";
import { opcionesProducto, parsearFiltroProductos, whereProducto, PRODUCTO_GENERAL } from "./filtro";

describe("parsearFiltroProductos", () => {
  it("sin parámetro es sin filtro", () => {
    expect(parsearFiltroProductos(undefined, ["a", "b"])).toBeNull();
  });
  it("descarta ids que ya no son válidos y vuelve a todos si no queda ninguno", () => {
    expect(parsearFiltroProductos("x,y", ["a", "b"])).toBeNull();
    expect(parsearFiltroProductos("a,x", ["a", "b"])).toEqual(["a"]);
  });
  it("vacío explícito es 'ninguno'", () => {
    expect(parsearFiltroProductos("", ["a"])).toEqual([]);
  });
});

describe("whereProducto", () => {
  it("null no filtra", () => {
    expect(whereProducto(null)).toEqual({});
  });
  it("mezcla ids y general", () => {
    expect(whereProducto(["a", PRODUCTO_GENERAL])).toEqual({ OR: [{ productoId: { in: ["a"] } }, { productoId: null }] });
  });
  it("sólo general", () => {
    expect(whereProducto([PRODUCTO_GENERAL])).toEqual({ OR: [{ productoId: null }] });
  });
});

describe("opcionesProducto", () => {
  it("sin productos no ofrece nada", () => {
    expect(opcionesProducto([])).toEqual([]);
  });
  it("prefija con la cuenta sólo si hay varias", () => {
    const uno = opcionesProducto([{ id: "1", nombre: "Funda", cuenta: { nombre: "mimada" } }]);
    expect(uno.map((o) => o.label)).toEqual(["General (marca)", "Funda"]);
    const dos = opcionesProducto([
      { id: "1", nombre: "Funda", cuenta: { nombre: "mimada" } },
      { id: "2", nombre: "Punching", cuenta: { nombre: "saume" } },
    ]);
    expect(dos[1].label).toBe("mimada · Funda");
  });
});
