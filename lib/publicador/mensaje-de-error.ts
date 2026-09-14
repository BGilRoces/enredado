/** Normaliza cualquier valor atrapado en un catch a un mensaje de error legible. */
export function mensajeDeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
