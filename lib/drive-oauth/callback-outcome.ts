export type CallbackOutcome =
  | { type: "proceed"; code: string }
  | { type: "error"; message: string };

interface DecideCallbackOutcomeInput {
  code: string | null;
  state: string | null;
  savedState: string | undefined;
  googleError: string | null;
}

/**
 * Decide qué hacer con el callback del OAuth offline de Google: seguir con
 * el `code` recibido, o rechazar (Google mandó un error, o el `state` no
 * matchea con el que guardamos en la cookie al iniciar el flujo — protección
 * CSRF). Mismo shape que lib/meta/callback-outcome.ts, para el flujo de Drive
 * en vez del de Meta.
 */
export function decideCallbackOutcome({
  code,
  state,
  savedState,
  googleError,
}: DecideCallbackOutcomeInput): CallbackOutcome {
  if (googleError) {
    return { type: "error", message: googleError };
  }
  if (!code || !state || !savedState || state !== savedState) {
    return {
      type: "error",
      message: "No se pudo validar el pedido de conexión, probá de nuevo.",
    };
  }
  return { type: "proceed", code };
}
