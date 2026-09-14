/** Espera real (setTimeout). Los tests inyectan una versión falsa sin reloj real. */
export function esperarMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
