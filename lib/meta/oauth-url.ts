/**
 * Login directo de Instagram ("Business Login for Instagram", producto
 * "Instagram API with Instagram Login" de Meta) — ver ADR-0012. Reemplaza a
 * Facebook Login for Business (ADR-0008): Meta discontinuó los permisos que
 * usaba ese flujo (`instagram_basic`/`instagram_content_publish`) el
 * 27/1/2025, así que nunca iba a poder publicar de verdad.
 *
 * No hay Login Configuration del lado de Meta acá — los permisos van
 * directo en el `scope` de la URL, como el login clásico de Facebook de
 * antes. Si se necesita un permiso nuevo a futuro, se agrega a este scope.
 */
const SCOPE = "instagram_business_basic,instagram_business_content_publish";

/** Arma la URL del diálogo de login de Instagram para conectar una Cuenta. */
export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", process.env.INSTAGRAM_APP_ID ?? "");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("state", state);
  return url.toString();
}
