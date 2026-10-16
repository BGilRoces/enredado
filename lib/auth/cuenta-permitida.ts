import { createClient } from "@/lib/supabase/server";

/**
 * `app_metadata.cuentaId`, seteado a mano en Supabase Studio al crear un
 * colaborador (mismo patrón que `app` en ADR-0006): restringe esa sesión a
 * una única Cuenta. Ausente = sin restricción (dueño del panel, ve todas).
 */
export async function obtenerCuentaIdPermitida(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const cuentaId = user?.app_metadata?.cuentaId;
  return typeof cuentaId === "string" ? cuentaId : null;
}

/**
 * Igual que asegurarAccesoACuenta pero para una Idea: un colaborador
 * restringido a una Cuenta también accede a las Ideas en colab donde su
 * Cuenta es una de las colaboradoras.
 */
export async function asegurarAccesoAIdea(idea: {
  cuentaId: string;
  colaboradoras: { id: string }[];
}): Promise<void> {
  const permitida = await obtenerCuentaIdPermitida();
  if (!permitida) return;
  if (permitida !== idea.cuentaId && !idea.colaboradoras.some((c) => c.id === permitida)) {
    throw new Error("No tenés acceso a esta Idea.");
  }
}

/** Tira si el usuario logueado está restringido a otra Cuenta distinta de `cuentaId`. */
export async function asegurarAccesoACuenta(cuentaId: string): Promise<void> {
  const permitida = await obtenerCuentaIdPermitida();
  if (permitida && permitida !== cuentaId) {
    throw new Error("No tenés acceso a esta Cuenta.");
  }
}
