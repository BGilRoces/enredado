import { mintDriveAccessToken } from "@/lib/drive-oauth/mint-access-token";

// Sin esto Next podría intentar resolverla en build time (necesita DB y env).
export const dynamic = "force-dynamic";

const ID_VALIDO = /^[\w-]+$/;
const TAMANO_PX = 400;
// Los access tokens de Google duran 1h: se reusa uno unos minutos para no
// pedir uno nuevo por cada miniatura (una carpeta trae hasta ~10 de golpe).
const TTL_TOKEN_MS = 30 * 60 * 1000;

let tokenCacheado: { valor: string; vence: number } | null = null;

async function obtenerToken(): Promise<string> {
  if (tokenCacheado && tokenCacheado.vence > Date.now()) return tokenCacheado.valor;
  const valor = await mintDriveAccessToken();
  tokenCacheado = { valor, vence: Date.now() + TTL_TOKEN_MS };
  return valor;
}

/**
 * Miniatura de un archivo de Drive (foto, o portada de un video) para
 * previsualizar sin bajar el archivo entero. Va por el servidor porque el
 * `thumbnailLink` de Drive no es confiable desde el browser (CORS, ver
 * app/publicar/drive-thumbnail.ts). Usa la conexión de Drive guardada; el
 * proxy ya exige sesión para /api/*.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") ?? "";
  const resourceKey = searchParams.get("rk") ?? undefined;
  if (!ID_VALIDO.test(id) || (resourceKey && !ID_VALIDO.test(resourceKey))) {
    return new Response("Parámetros inválidos", { status: 400 });
  }

  let token: string;
  try {
    token = await obtenerToken();
  } catch {
    return new Response("Drive no conectado", { status: 503 });
  }

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (resourceKey) headers["X-Goog-Drive-Resource-Keys"] = `${id}/${resourceKey}`;

  const meta = await fetch(
    `https://www.googleapis.com/drive/v3/files/${id}?fields=thumbnailLink&supportsAllDrives=true`,
    { headers }
  );
  if (!meta.ok) return new Response("No encontrado", { status: 404 });
  const thumbnailLink = (await meta.json())?.thumbnailLink as string | undefined;
  if (!thumbnailLink) return new Response("Sin miniatura", { status: 404 });

  // El link trae un tamaño por defecto (`=s220`) al final: se pide uno mayor.
  const imagen = await fetch(thumbnailLink.replace(/=s\d+$/, `=s${TAMANO_PX}`), { headers });
  if (!imagen.ok) return new Response("Sin miniatura", { status: 404 });

  return new Response(imagen.body, {
    headers: {
      "Content-Type": imagen.headers.get("Content-Type") ?? "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
