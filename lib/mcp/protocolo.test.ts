import { describe, expect, it } from "vitest";
import { manejarCuerpo, manejarMensaje, type Herramienta } from "./protocolo";

const servidor = { name: "test", version: "0.0.1", instrucciones: "hola" };

const eco: Herramienta = {
  name: "eco",
  description: "devuelve lo que le pasan",
  inputSchema: { type: "object" },
  ejecutar: async (args) => args,
};
const rota: Herramienta = {
  name: "rota",
  description: "siempre falla",
  inputSchema: { type: "object" },
  ejecutar: async () => {
    throw new Error("falló a propósito");
  },
};
const herramientas = [eco, rota];

const llamar = (method: string, params?: unknown, id: number | null = 1) =>
  manejarMensaje({ jsonrpc: "2.0", id, method, params }, herramientas, servidor);

describe("manejarMensaje", () => {
  it("initialize devuelve la versión pedida si la soporta, con capabilities de tools", async () => {
    const r = await llamar("initialize", { protocolVersion: "2025-03-26" });
    expect(r?.result).toMatchObject({
      protocolVersion: "2025-03-26",
      capabilities: { tools: {} },
      serverInfo: { name: "test" },
      instructions: "hola",
    });
  });

  it("initialize ofrece la versión más nueva si la pedida no se conoce", async () => {
    const r = await llamar("initialize", { protocolVersion: "1999-01-01" });
    expect((r?.result as { protocolVersion: string }).protocolVersion).toBe("2025-06-18");
  });

  it("tools/list no expone la función ejecutar", async () => {
    const r = await llamar("tools/list");
    const tools = (r?.result as { tools: Record<string, unknown>[] }).tools;
    expect(tools.map((t) => t.name)).toEqual(["eco", "rota"]);
    expect(tools[0]).not.toHaveProperty("ejecutar");
  });

  it("tools/call devuelve el resultado como texto", async () => {
    const r = await llamar("tools/call", { name: "eco", arguments: { a: 1 } });
    expect(r?.result).toEqual({ content: [{ type: "text", text: JSON.stringify({ a: 1 }, null, 2) }] });
  });

  it("un fallo de la herramienta vuelve como isError, no como error JSON-RPC", async () => {
    const r = await llamar("tools/call", { name: "rota" });
    expect(r?.error).toBeUndefined();
    expect(r?.result).toEqual({ content: [{ type: "text", text: "falló a propósito" }], isError: true });
  });

  it("herramienta desconocida y método desconocido son errores JSON-RPC", async () => {
    expect((await llamar("tools/call", { name: "nada" }))?.error?.code).toBe(-32602);
    expect((await llamar("no/existe"))?.error?.code).toBe(-32601);
  });

  it("las notificaciones no tienen respuesta", async () => {
    const r = await manejarMensaje({ jsonrpc: "2.0", method: "notifications/initialized" }, herramientas, servidor);
    expect(r).toBeNull();
  });

  it("rechaza mensajes que no son JSON-RPC", async () => {
    expect((await manejarMensaje({ hola: 1 }, herramientas, servidor))?.error?.code).toBe(-32600);
  });
});

describe("manejarCuerpo", () => {
  it("responde un batch omitiendo las notificaciones", async () => {
    const r = await manejarCuerpo(
      [
        { jsonrpc: "2.0", id: 1, method: "ping" },
        { jsonrpc: "2.0", method: "notifications/initialized" },
      ],
      herramientas,
      servidor
    );
    expect(r).toEqual([{ jsonrpc: "2.0", id: 1, result: {} }]);
  });
});
