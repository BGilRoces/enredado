# 08: Límite diario de publicaciones por Cuenta

**What to build:** Que el panel respete el tope diario de publicaciones que impone la Graph API por Cuenta, evitando intentar publicar de más y arriesgar una Cuenta real por exceso de llamadas.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] El panel conoce cuántas Publicaciones ya salieron hoy por cada Cuenta.
- [ ] Si una Cuenta llegó a su límite diario, una nueva Publicación (inmediata o programada que vence) para esa Cuenta no se intenta contra Meta — queda señalada como bloqueada por límite, no como fallo genérico.
- [ ] Una Publicación bloqueada por límite diario se distingue claramente en el historial (ticket 06) de una que falló por otro motivo.
- [ ] El conteo se resetea correctamente al pasar el día (según el criterio que use la propia API de Meta para su ventana de 24hs).
- [ ] La lógica de límite se testea con datos armados a mano (conteos y horarios fijos), sin depender de que pase un día real.
