/**
 * OAuth "offline" de Google para que el servidor pueda bajar archivos de
 * Drive sin depender del Picker interactivo del navegador (ver ADR-0014).
 * Distinto del login del Picker (`use-google-picker.ts`, client-side, scope
 * `drive.readonly` con un access token de ~1h): acá se pide además
 * `access_type=offline` para recibir un refresh token, y `prompt=consent`
 * para forzar que Google lo entregue incluso si Bautista ya había dado este
 * mismo permiso antes (Google sólo manda el refresh token la primera vez que
 * consiente, salvo que se fuerce el diálogo de nuevo).
 */
const SCOPE = "https://www.googleapis.com/auth/drive.readonly";

/** Arma la URL del diálogo de consentimiento offline de Google. */
export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}
