/**
 * Hook de arranque de Next.js: corre una vez por proceso al bootear el
 * servidor. Se usa para arrancar los workers en memoria (scheduler de
 * Publicaciones — ADR-0004 — y renovación de tokens de Meta — ticket 07) sin
 * depender de un cron de sistema ni de una cola externa.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startPublicadorWorker } = await import("@/lib/worker/publicador-worker");
  startPublicadorWorker();
  const { startTokenRenewalWorker } = await import("@/lib/worker/token-renewal-worker");
  startTokenRenewalWorker();
}
