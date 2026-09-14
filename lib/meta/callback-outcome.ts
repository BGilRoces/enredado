export type CallbackOutcome =
  | { type: "proceed"; code: string }
  | { type: "error"; message: string };

interface DecideCallbackOutcomeInput {
  code: string | null;
  state: string | null;
  savedState: string | undefined;
  metaError: string | null;
}

/**
 * Decide qué hacer con el callback de OAuth de Meta: seguir con el `code`
 * recibido, o rechazar (Meta mandó un error, o el `state` no matchea con el
 * que guardamos en la cookie al iniciar el flujo — protección CSRF).
 */
export function decideCallbackOutcome({
  code,
  state,
  savedState,
  metaError,
}: DecideCallbackOutcomeInput): CallbackOutcome {
  if (metaError) {
    return { type: "error", message: metaError };
  }
  if (!code || !state || !savedState || state !== savedState) {
    return {
      type: "error",
      message: "No se pudo validar el pedido de conexión, probá de nuevo.",
    };
  }
  return { type: "proceed", code };
}
