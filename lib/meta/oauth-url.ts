import { GRAPH_VERSION } from "./config";

/**
 * Apps de tipo Business ya no exponen el login clásico de Facebook (con
 * `scope`) en el dashboard de Meta — solo Facebook Login for Business, que
 * agrupa los permisos en una Login Configuration del lado de Meta. Los
 * permisos (pages_show_list, pages_read_engagement, instagram_basic,
 * instagram_content_publish) se eligen ahí, no acá: si se agrega un permiso
 * nuevo hay que sumarlo también a esa Configuration en el dashboard.
 */

/** Arma la URL del diálogo de login de Meta para conectar una Cuenta. */
export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", process.env.META_APP_ID ?? "");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("config_id", process.env.META_LOGIN_CONFIG_ID ?? "");
  url.searchParams.set("response_type", "code");
  return url.toString();
}
