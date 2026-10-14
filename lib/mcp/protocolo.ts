/**
 * Mínimo del protocolo MCP sobre HTTP (transporte "Streamable HTTP", sólo
 * respuestas JSON, sin streams ni sesiones): suficiente para que un cliente
 * (claude.ai, Claude Code) liste y llame herramientas. Se implementa a mano en
 * vez de sumar el SDK oficial porque el panel vive en un VPS compartido (ver
 * ADR-0003) y esto es un único POST stateless — ver ADR-0017.
 */

export const VERSIONES_SOPORTADAS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;

export interface Herramienta {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
  ejecutar: (argumentos: unknown) => Promise<unknown>;
}

export interface InfoServidor {
  name: string;
  version: string;
  instrucciones: string;
}

export type JsonRpcId = string | number | null;

export interface JsonRpcRespuesta {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const ERROR_PARSEO = -32700;
const ERROR_REQUEST_INVALIDO = -32600;
const ERROR_METODO = -32601;
const ERROR_PARAMS = -32602;

function error(id: JsonRpcId, code: number, message: string): JsonRpcRespuesta {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function textoDeResultado(valor: unknown): string {
  return typeof valor === "string" ? valor : JSON.stringify(valor, null, 2);
}

/**
 * Procesa un único mensaje JSON-RPC. Devuelve `null` para las notificaciones
 * (mensajes sin `id`), que el transporte responde con 202 sin cuerpo.
 */
export async function manejarMensaje(
  mensaje: unknown,
  herramientas: Herramienta[],
  servidor: InfoServidor
): Promise<JsonRpcRespuesta | null> {
  if (!esObjeto(mensaje) || mensaje.jsonrpc !== "2.0" || typeof mensaje.method !== "string") {
    return error(null, ERROR_REQUEST_INVALIDO, "Mensaje JSON-RPC inválido.");
  }

  const esNotificacion = !("id" in mensaje);
  const id = (esNotificacion ? null : mensaje.id) as JsonRpcId;
  if (esNotificacion) return null;

  const params = esObjeto(mensaje.params) ? mensaje.params : {};

  switch (mensaje.method) {
    case "initialize": {
      const pedida = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
      const protocolVersion = (VERSIONES_SOPORTADAS as readonly string[]).includes(pedida)
        ? pedida
        : VERSIONES_SOPORTADAS[0];
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: servidor.name, version: servidor.version },
          instructions: servidor.instrucciones,
        },
      };
    }

    case "ping":
      return { jsonrpc: "2.0", id, result: {} };

    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: herramientas.map(({ name, title, description, inputSchema, annotations }) => ({
            name,
            title,
            description,
            inputSchema,
            annotations,
          })),
        },
      };

    case "tools/call": {
      const nombre = params.name;
      const herramienta = herramientas.find((h) => h.name === nombre);
      if (typeof nombre !== "string" || !herramienta) {
        return error(id, ERROR_PARAMS, `Herramienta desconocida: ${String(nombre)}`);
      }
      try {
        const resultado = await herramienta.ejecutar(params.arguments ?? {});
        return {
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: textoDeResultado(resultado) }] },
        };
      } catch (e) {
        // Los fallos de la herramienta van como resultado con isError (no como
        // error JSON-RPC) para que el modelo los lea y pueda corregirse.
        const texto = e instanceof Error ? e.message : String(e);
        return {
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: texto }], isError: true },
        };
      }
    }

    default:
      return error(id, ERROR_METODO, `Método no soportado: ${mensaje.method}`);
  }
}

/** Cuerpo entero de un POST: un mensaje, o un batch (lo aceptan las versiones 2024-11-05 y 2025-03-26). */
export async function manejarCuerpo(
  cuerpo: unknown,
  herramientas: Herramienta[],
  servidor: InfoServidor
): Promise<JsonRpcRespuesta | JsonRpcRespuesta[] | null> {
  if (Array.isArray(cuerpo)) {
    if (cuerpo.length === 0) return error(null, ERROR_REQUEST_INVALIDO, "Batch vacío.");
    const respuestas = (
      await Promise.all(cuerpo.map((m) => manejarMensaje(m, herramientas, servidor)))
    ).filter((r): r is JsonRpcRespuesta => r !== null);
    return respuestas.length > 0 ? respuestas : null;
  }
  return manejarMensaje(cuerpo, herramientas, servidor);
}

export function errorDeParseo(): JsonRpcRespuesta {
  return error(null, ERROR_PARSEO, "JSON inválido.");
}
