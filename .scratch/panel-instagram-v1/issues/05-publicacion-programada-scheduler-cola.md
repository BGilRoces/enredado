# 05: Publicación programada (scheduler + cola secuencial)

**What to build:** Programar una Publicación (Post, Historia o Reel, imagen o video) para un momento futuro, verla en una lista de pendientes, cancelarla o editarla antes de que salga, y que el scheduler en memoria más la cola secuencial la disparen solas en su momento — procesando de a una Publicación por vez, nunca en paralelo (ADR-0004, ADR-0005).

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Al crear una Publicación, se puede elegir "ahora" o una fecha/hora futura en vez de publicar de inmediato.
- [ ] Lista de Publicaciones programadas pendientes, agrupable/filtrable por Cuenta.
- [ ] Acción para cancelar o editar una Publicación programada mientras siga pendiente (no si ya se disparó).
- [ ] Scheduler: función pura, testeada con una hora "ahora" fija y una lista de Publicaciones armada a mano, que decide cuáles ya vencieron.
- [ ] El scheduler corre como intervalo en memoria dentro del proceso Next.js (sin cron de sistema ni cola externa tipo Redis/BullMQ).
- [ ] Cola de publicación: función pura que, dado el estado actual (una Publicación en curso o no) y las pendientes, decide cuál sigue — nunca deja avanzar dos a la vez.
- [ ] Si dos o más Publicaciones vencen al mismo tiempo, se procesan en orden, una por una, no simultáneamente.
