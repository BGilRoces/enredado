/** Config compartida por el cliente de Meta y el armado de la URL de OAuth. */
export const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v21.0";
export const OAUTH_STATE_COOKIE = "meta_oauth_state";

/**
 * Origen público y estable del panel. No se puede derivar de `request.url`
 * en las Route Handlers de Meta: detrás del proxy de Coolify, Next.js las ve
 * como si vinieran de localhost (el bind interno del contenedor) en vez del
 * dominio real — confirmado en producción, Meta terminó redirigiendo el
 * login a http://localhost:3000.
 */
export const APP_URL = process.env.APP_URL ?? "";
