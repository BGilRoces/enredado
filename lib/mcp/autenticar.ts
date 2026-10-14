import { createHash, timingSafeEqual } from "node:crypto";

function digest(valor: string): Buffer {
  return createHash("sha256").update(valor).digest();
}

/**
 * Compara el token recibido contra el configurado en tiempo constante (se
 * hashea primero para que `timingSafeEqual` reciba siempre buffers del mismo
 * largo). Un token configurado vacío o demasiado corto nunca autoriza: mejor
 * dejar el endpoint cerrado que abierto por una env var mal copiada.
 */
export function tokenValido(recibido: string | null | undefined, esperado: string | undefined): boolean {
  const configurado = normalizarToken(esperado);
  if (!servidorConfigurado(esperado)) return false;
  if (!recibido) return false;
  return timingSafeEqual(digest(recibido.trim()), digest(configurado));
}

/** Las env vars pegadas en un panel (Coolify) suelen traer espacios, saltos de línea o comillas de más. */
function normalizarToken(valor: string | undefined): string {
  return (valor ?? "").trim().replace(/^(["'])(.*)\1$/, "$2").trim();
}

/** Hay un token configurado y es lo bastante largo como para aceptarse (ver tokenValido). */
export function servidorConfigurado(esperado: string | undefined): boolean {
  return normalizarToken(esperado).length >= 32;
}

/** Extrae el token de `Authorization: Bearer <token>`, o null si no viene en esa forma. */
export function tokenDeAuthorization(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}
