/**
 * Hook de arranque de Next.js: corre una vez por proceso al bootear el
 * servidor. Se usa para arrancar el scheduler en memoria (ADR-0004) sin
 * depender de un cron de sistema ni de una cola externa.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startPublicadorWorker } = await import("@/lib/worker/publicador-worker");
  startPublicadorWorker();
}
