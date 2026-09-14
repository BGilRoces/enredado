import { GRAPH_VERSION } from "./config";

const SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_content_publish",
];

/** Arma la URL del diálogo de login de Meta para conectar una Cuenta. */
export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", process.env.META_APP_ID ?? "");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", SCOPES.join(","));
  url.searchParams.set("response_type", "code");
  return url.toString();
}
