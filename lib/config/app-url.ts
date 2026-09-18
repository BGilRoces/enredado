/**
 * Origen público y estable del panel (con esquema, sin barra final). No se
 * puede derivar de `request.url` en las Route Handlers: detrás del proxy de
 * Coolify, Next.js las ve como si vinieran de localhost (el bind interno del
 * contenedor) en vez del dominio real — confirmado en producción con el
 * login de Meta, que terminó redirigiendo a http://localhost:3000.
 *
 * Vivía en lib/meta/config.ts hasta que el login de Google (ver ADR-0014)
 * también lo necesitó — no es específico de Meta.
 */
export const APP_URL = process.env.APP_URL ?? "";
