# 06: Historial completo y manejo de errores

**What to build:** Ver todo lo publicado (inmediato y programado) con su resultado, y que un fallo — de Meta o de una Publicación programada — se vea claro en el panel sin tener que adivinar ni revisar logs del servidor.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Vista de historial con todas las Publicaciones (Cuenta, tipo, fecha, estado: publicada/fallida/programada/pendiente).
- [ ] El motivo de un fallo (rechazo de Meta, timeout de procesamiento de video, error de red, etc.) se muestra en texto claro, no como un código o stack trace crudo.
- [ ] Una Publicación programada que falló al dispararse se distingue claramente de una que todavía está pendiente.
- [ ] El historial permite filtrar al menos por Cuenta y por estado.
- [ ] No hace falta email ni ninguna notificación externa — toda la señal vive dentro del panel (no hay SMTP configurado en `shared-infra`).
