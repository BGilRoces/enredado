# 08: Límite diario de publicaciones por Cuenta

**What to build:** Que el panel respete el tope diario de publicaciones que impone la Graph API por Cuenta, evitando intentar publicar de más y arriesgar una Cuenta real por exceso de llamadas.

**Blocked by:** 05

**Status:** done (código) — no depende de la infra de Google/Storage de los tickets 03-06

- [x] El panel conoce cuántas Publicaciones ya salieron hoy por cada Cuenta.
- [x] Si una Cuenta llegó a su límite diario, una nueva Publicación (inmediata o programada que vence) para esa Cuenta no se intenta contra Meta — queda señalada como bloqueada por límite, no como fallo genérico.
- [x] Una Publicación bloqueada por límite diario se distingue claramente en el historial (ticket 06) de una que falló por otro motivo.
- [x] El conteo se resetea correctamente al pasar el día (según el criterio que use la propia API de Meta para su ventana de 24hs).
- [x] La lógica de límite se testea con datos armados a mano (conteos y horarios fijos), sin depender de que pase un día real.

## Avance

**Hecho en código, verificado con tests/typecheck/build/lint (todo verde, 60 tests):**
- Meta documenta este límite con una **ventana móvil de 24hs**, no un reset a medianoche (la capacidad de una Publicación se libera 24hs después de esa Publicación puntual, no a las 00:00) — confirmado antes de implementar. Meta también expone `GET /{ig-user-id}/content_publishing_limit` para consultar el uso real, pero se descartó depender de él: la forma exacta de su respuesta no se pudo verificar en vivo (mismo bloqueo de infra de los tickets 03-06) y el panel ya tiene todo el historial necesario para calcularlo solo, sin sumar una llamada extra a Meta antes de cada intento.
- `lib/limite-diario/excedio-limite-diario.ts` (6 tests): función pura — dado "ahora", una lista de momentos en que se publicó, un límite y el tamaño de la ventana, decide si ya se excedió. Los tests cubren el borde exacto de la ventana (una Publicación de hace exactamente 24hs ya no cuenta) y que Publicaciones viejas fuera de la ventana no arrastran nunca el conteo.
- `Publicacion` suma `publicadaEn: DateTime?`, seteado recién cuando `publicarDesdeStorage` confirma el éxito — se agregó a propósito en vez de reusar `actualizadaEn` (que se mueve con cualquier update a la fila), para que el cálculo del límite no dependa de una asunción implícita sobre qué más podría llegar a tocar una fila "publicada" en el futuro.
- `lib/worker/publicador-worker.ts`: `procesarUna` gana un tercer guard (`superaLimiteDiario`, extraído a su propia función siguiendo el mismo patrón que `renovarCuenta` del ticket 07) entre "¿la Cuenta sigue conectada?" y "¿está preparado el archivo?" y el intento real de publicar — corre tanto para el camino "ahora" como para uno programado que recién vence, ambos pasan por acá.
- Nuevo `EstadoPublicacion.bloqueadaPorLimite`, distinto de `fallida` — se ve así en `/historial` y en "Últimas Publicaciones" de `/publicar` (filtros y etiqueta actualizados en `components/etiqueta-estado.ts`).
- `/cuentas` ahora muestra, por Cuenta conectada, "X/50 publicadas (últimas 24hs)" — antes el conteo solo vivía puertas adentro del worker.
- **Decisión de scope, documentada a propósito**: una Publicación `bloqueadaPorLimite` no se reintenta sola cuando la ventana se libera — queda terminal, igual que una `fallida`, con un mensaje que invita a crearla de nuevo. Automatizar el reintento es una función nueva (no pedida acá) y el proyecto no tiene hoy ningún mecanismo de reintento para ningún otro tipo de fallo tampoco; agregarlo solo para este caso hubiera sido inconsistente.
- Pasó por `/code-review` (Standards + Spec) contra el punto de partida del ticket 07 (`89c35de`): se corrigieron los dos hallazgos de Standards (el chequeo de límite había quedado inline en `procesarUna` en vez de extraído como `renovarCuenta` en el ticket 07; el `take: 200` de la query era un número mágico sin relación con `LIMITE_PUBLICACIONES_POR_VENTANA`) y el hallazgo de Spec sobre `actualizadaEn` (resuelto agregando `publicadaEn`, más robusto que solo documentar la asunción). De paso: el fix de `/cuentas` chocó con una regla de ESLint de pureza de React (no llamar `Date.now()` directo en el cuerpo de un Server Component) — se movió ese cálculo a una función aparte.

Con este ticket se cierran los 8 tickets del spec `panel-instagram-v1`. Pendiente en todos los que tocan Drive/Storage (03-06): correr el wizard de Google Cloud + Supabase Storage para probarlos de punta a punta en producción.
