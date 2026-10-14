import { NextResponse } from "next/server";
import { servidorConfigurado, tokenDeAuthorization, tokenValido } from "./autenticar";
import { errorDeParseo, manejarCuerpo } from "./protocolo";
import { herramientas, INSTRUCCIONES } from "./herramientas";

const MAX_CUERPO_BYTES = 256 * 1024;

const SERVIDOR = { name: "enredado", version: "1.0.0", instrucciones: INSTRUCCIONES };

/**
 * Handler compartido de `/api/mcp` (token en `Authorization: Bearer`) y
 * `/api/mcp/<token>` (token en la URL, para conectores que no permiten
 * headers custom — ver ADR-0017). Esta ruta está fuera del login de Supabase
 * (ver lib/auth/decide-redirect.ts): el token ES la autenticación.
 */
export async function manejarPeticionMcp(request: Request, tokenDeRuta: string | null): Promise<Response> {
  const recibido = tokenDeRuta ?? tokenDeAuthorization(request.headers.get("authorization"));
  const esperado = process.env.MCP_API_TOKEN;
  if (!tokenValido(recibido, esperado)) {
    // Distinguir "el servidor no tiene token" de "el token no coincide": desde
    // afuera ambos son un 401 y no hay forma de saber cuál es (sin revelar
    // ningún valor). El largo recibido sólo va al log del servidor.
    const sinConfigurar = !servidorConfigurado(esperado);
    console.warn(
      sinConfigurar
        ? "[mcp] rechazado: MCP_API_TOKEN no está configurado o tiene menos de 32 caracteres."
        : `[mcp] rechazado: token no coincide (recibido de ${recibido?.length ?? 0} caracteres).`
    );
    return NextResponse.json(
      {
        error: sinConfigurar
          ? "MCP_API_TOKEN no está configurado en el servidor (o tiene menos de 32 caracteres)."
          : "No autorizado",
      },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } }
    );
  }

  const texto = await request.text();
  if (texto.length > MAX_CUERPO_BYTES) {
    return NextResponse.json({ error: "Cuerpo demasiado grande" }, { status: 413 });
  }

  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    return NextResponse.json(errorDeParseo(), { status: 400 });
  }

  const respuesta = await manejarCuerpo(cuerpo, herramientas, SERVIDOR);
  // Sólo notificaciones: el transporte pide 202 sin cuerpo.
  if (respuesta === null) return new Response(null, { status: 202 });
  return NextResponse.json(respuesta);
}

/** Este servidor no abre stream SSE ni sesiones: GET/DELETE no aplican. */
export function metodoNoPermitido(): Response {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
