/**
 * Hook de arranque de Next.js: corre una vez por proceso al bootear el
 * servidor. Sólo arranca la renovación de tokens de Meta (ticket 07): el
 * panel ya no publica ni promociona Ideas solo (ver ADR-0020), así que el
 * scheduler de Publicaciones (ADR-0004) y el worker de Ideas (ADR-0013) no
 * se arrancan más. El código queda en lib/worker por si se retoma.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startTokenRenewalWorker } = await import("@/lib/worker/token-renewal-worker");
  startTokenRenewalWorker();
}
