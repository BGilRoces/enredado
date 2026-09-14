# 05: Publicación programada (scheduler + cola secuencial)

**What to build:** Programar una Publicación (Post, Historia o Reel, imagen o video) para un momento futuro, verla en una lista de pendientes, cancelarla o editarla antes de que salga, y que el scheduler en memoria más la cola secuencial la disparen solas en su momento — procesando de a una Publicación por vez, nunca en paralelo (ADR-0004, ADR-0005).

**Blocked by:** 04

**Status:** done (código) — mismo bloqueo de infra real que los tickets 03/04 (Google Cloud + Supabase Storage)

- [x] Al crear una Publicación, se puede elegir "ahora" o una fecha/hora futura en vez de publicar de inmediato.
- [x] Lista de Publicaciones programadas pendientes, filtrable por Cuenta.
- [x] Acción para cancelar o editar una Publicación programada mientras siga pendiente (no si ya se disparó).
- [x] Scheduler: función pura, testeada con una hora "ahora" fija y una lista de Publicaciones armada a mano, que decide cuáles ya vencieron.
- [x] El scheduler corre como intervalo en memoria dentro del proceso Next.js (sin cron de sistema ni cola externa tipo Redis/BullMQ).
- [x] Cola de publicación: función pura que, dado el estado actual (una Publicación en curso o no) y las pendientes, decide cuál sigue — nunca deja avanzar dos a la vez.
- [x] Si dos o más Publicaciones vencen al mismo tiempo, se procesan en orden, una por una, no simultáneamente.

## Avance

**Hecho en código, verificado con tests/typecheck/build/lint (todo verde, 47 tests):**
- **ADR-0009, decisión no anticipada por el spec original**: el token de Google del Picker dura ~1 hora — una Publicación programada para más adelante no puede esperar a la cola para bajar el archivo de Drive, el token ya habría vencido. Se partió el Publicador (que el ticket 04 dejó como un solo `publicar()`) en dos pasos: `lib/publicador/preparar-archivo.ts` (baja de Drive + sube a Storage, corre **al crear** la Publicación, sea inmediata o programada) y `lib/publicador/publicar-desde-storage.ts` (contenedor + poll + publish + borrar, corre **cuando la cola la dispara**, sea al toque o días después). El campo `tipoMedia`/`storageUrl` quedan guardados en la fila desde que se crea.
- `lib/scheduler/decidir-vencidas.ts` (6 tests) y `lib/cola/decidir-siguiente.ts` (4 tests): las dos funciones puras que pide el ticket, con "ahora" fijo y listas armadas a mano, sin timers reales.
- `lib/worker/publicador-worker.ts`: `tick()` reentrante-seguro (un booleano en memoria) que consulta Prisma, llama a las dos funciones puras, y dispara `publicarDesdeStorage` de a una. `startPublicadorWorker()` arranca el `setInterval` (cada 2 minutos, ADR-0004) una sola vez por proceso, guardado con el mismo patrón `globalThis` que `lib/db/prisma.ts` — nunca se registra en import time, así que no interfiere con `next build`.
- `instrumentation.ts`: hook nativo de Next.js para arrancar el worker una vez al bootear el servidor (reemplaza cualquier necesidad de cron/servicio externo).
- Prisma: `Publicacion` suma `programadaPara`, `tipoMedia`, `storageUrl`; `EstadoPublicacion` suma `pendiente` (nuevo default) y `cancelada`.
- `app/publicar/`: toggle "Ahora"/"Programar para" en el form, lista de Pendientes filtrable por Cuenta con cancelar/editar (caption + fecha, en horario UTC) inline vía Server Actions — tipo y Cuenta no son editables (invalidarían el archivo ya preparado, ver ADR-0009).
- Pasó por `/code-review` (Standards + Spec) contra el punto de partida del ticket 04 (`0b0eb39`):
  - **Spec, bug de concurrencia real corregido**: `procesarUna` pasaba a "publicando" con un `update` por id a secas, usando además los datos del snapshot que armó `tick()` antes de la ronda de red a la base. Si alguien cancelaba la Publicación en esa ventana, el worker la revivía igual y la publicaba en Meta — se corrigió a un `updateMany` guardado por `estado: pendiente` (aborta si ya no lo está) y releyendo la fila fresca recién después de ganar esa carrera.
  - **Spec, gap menor corregido**: el orden ante empates de `programadaPara` no tenía desempate estable — se agregó `id` como criterio secundario de orden.
  - **Standards, violación dura corregida**: `lib/worker/publicador-worker.ts` comparaba `cuenta.estado !== "conectada"` con un string suelto (`EstadoCuenta` ni se importaba), rompiendo la convención de enum que el resto del diff (y `app/cuentas/page.tsx`) ya respeta.
  - **Standards**: se extrajo `lib/publicador/mensaje-de-error.ts` (la normalización `error instanceof Error ? error.message : String(error)` estaba triplicada tras partir el Publicador en dos).

**Pendiente — mismo bloqueo real que los tickets 03/04:** falta crear las credenciales de Google Cloud (Picker) y el bucket de Supabase Storage — wizard ya armado, ver Avance del ticket 03.
