# 03: Worker — preparar lazy + promoción de Ideas

**What to build:** Rama nueva en `procesarUna` para preparar lazy (ADR-0015), y el worker hermano que promociona Ideas elegibles a Publicaciones reales (ADR-0013).

**Blocked by:** 01, 02

**Status:** done (código) — sin probar contra infra real (mismo bloqueo que 02)

- [x] `lib/publicador/preparar-si-hace-falta.ts` (+ test) — inyectado, mintea token, llama a `prepararArchivo` existente sin modificarla.
- [x] `procesarUna` en `lib/worker/publicador-worker.ts`: nueva rama gateada por `publicacion.idea`, camino de `/publicar` intacto (releído con `include: idea` recién en la rama nueva, la existente no cambia de forma).
- [x] `lib/ideas/decidir-ideas-para-promover.ts` (+ test) — pura.
- [x] `lib/ideas/promover-idea.ts` — create + link.
- [x] `lib/ideas/parsear-drive-file-id.ts` (+ test).
- [x] `lib/ideas/es-atrasada.ts` (+ test).
- [x] `lib/worker/ideas-worker.ts` — `tick()` propio, dispara el `tick()` del publicador-worker después de promover.
- [x] `instrumentation.ts` arranca `startIdeasWorker()`.

## Avance

97 tests pasando (19 archivos), `tsc --noEmit`/lint/`next build` limpios. Nota de implementación no anticipada por el plan: `es-atrasada.ts` también chequea `publicacionId` (no sólo `estado`/`programadaPara`) — una Idea ya promocionada nunca debe mostrarse como "atrasada" aunque su `estado` de Idea haya quedado desactualizado, porque de ahí en más el estado real vive en la Publicación vinculada.
