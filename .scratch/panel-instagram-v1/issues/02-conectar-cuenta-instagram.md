# 02: Conectar una Cuenta de Instagram

**What to build:** Alta de una Cuenta de Instagram en el panel: guarda su token de Meta de forma privada, se puede ver listada, y se puede desconectar sin borrar su historial de Publicaciones (que todavía no existe en este ticket, pero el modelo de datos lo debe permitir a futuro).

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Formulario/flujo para conectar una Cuenta de Instagram (Business/Creator vinculada a una Página de Facebook) usando el login de Meta, guardando el token de acceso de forma privada (nunca visible en la UI ni en logs).
- [ ] Lista de Cuentas de Instagram conectadas, visible en el panel.
- [ ] Acción para desconectar una Cuenta (elimina/invalida su token, no borra registros históricos asociados).
- [ ] El token de cada Cuenta se guarda de forma aislada por Cuenta — conectar varias Cuentas no las mezcla ni pisa entre sí.
- [ ] Si la conexión con Meta falla (permisos insuficientes, cuenta no es Business/Creator, etc.), el panel muestra un error claro en vez de guardar una Cuenta a medio configurar.
