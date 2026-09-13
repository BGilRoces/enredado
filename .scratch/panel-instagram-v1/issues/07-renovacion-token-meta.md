# 07: Renovación automática del token de Meta

**What to build:** Que el token de acceso de cada Cuenta de Instagram se renueve solo antes de vencer (los long-lived tokens de Meta duran ~60 días), sin que haga falta reconectar la cuenta a mano.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] El panel sabe la fecha de vencimiento del token de cada Cuenta conectada.
- [ ] Antes de que el token de una Cuenta venza, el panel lo renueva automáticamente vía la Graph API, sin intervención manual.
- [ ] Si la renovación falla (por ejemplo, el usuario revocó el acceso desde Meta), la Cuenta queda marcada como "necesita reconexión" en vez de fallar en silencio la próxima vez que se intente publicar con ella.
- [ ] La lógica de renovación se testea con un fake del cliente de Meta, sin pegar contra la API real ni depender de esperar 60 días de verdad.
