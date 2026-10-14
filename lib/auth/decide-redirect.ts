const PUBLIC_ROUTES = new Set(["/login", "/acerca", "/privacidad", "/terminos"]);

/**
 * Rutas que se autentican por su cuenta (no con la sesión de Supabase): el
 * servidor MCP valida su propio token (ver ADR-0017, lib/mcp/http.ts).
 */
const SELF_AUTHENTICATED_PREFIXES = ["/api/mcp"];

export function isSelfAuthenticated(pathname: string): boolean {
  return SELF_AUTHENTICATED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export type AuthDecision =
  | { action: "allow" }
  | { action: "redirect"; to: string }
  | { action: "json-401" };

interface DecideAuthRedirectInput {
  /** Hay una sesión de Supabase Auth válida, sin importar a qué app pertenece. */
  hasSession: boolean;
  /**
   * La sesión pertenece a este panel (`app_metadata.app === "enredado"`), no a
   * otra app que comparte la misma instancia de Supabase Auth (`shared-infra`).
   */
  belongsToThisApp: boolean;
  pathname: string;
}

export function decideAuthRedirect({
  hasSession,
  belongsToThisApp,
  pathname,
}: DecideAuthRedirectInput): AuthDecision {
  const isAuthorized = hasSession && belongsToThisApp;
  const isPublicRoute = PUBLIC_ROUTES.has(pathname) || isSelfAuthenticated(pathname);

  if (!isAuthorized && !isPublicRoute) {
    return pathname.startsWith("/api/")
      ? { action: "json-401" }
      : { action: "redirect", to: "/login" };
  }

  if (isAuthorized && pathname === "/login") {
    return { action: "redirect", to: "/" };
  }

  return { action: "allow" };
}
