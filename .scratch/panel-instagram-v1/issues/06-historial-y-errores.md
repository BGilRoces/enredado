# 06: Historial completo y manejo de errores

**What to build:** Ver todo lo publicado (inmediato y programado) con su resultado, y que un fallo — de Meta o de una Publicación programada — se vea claro en el panel sin tener que adivinar ni revisar logs del servidor.

**Blocked by:** 05

**Status:** done (código) — mismo bloqueo de infra real que los tickets 03/04/05

- [x] Vista de historial con todas las Publicaciones (Cuenta, tipo, fecha, estado: publicada/fallida/programada/pendiente).
- [x] El motivo de un fallo (rechazo de Meta, timeout de procesamiento de video, error de red, etc.) se muestra en texto claro, no como un código o stack trace crudo.
- [x] Una Publicación programada que falló al dispararse se distingue claramente de una que todavía está pendiente.
- [x] El historial permite filtrar al menos por Cuenta y por estado.
- [x] No hace falta email ni ninguna notificación externa — toda la señal vive dentro del panel (no hay SMTP configurado en `shared-infra`).

## Avance

**Hecho en código, verificado con tests/typecheck/build/lint (todo verde, 47 tests):**
- `app/historial/page.tsx`: lista todas las Publicaciones (hasta 100, más recientes primero), filtrable por Cuenta y por estado vía query params.
- No existe un estado "programada" en la base — es "pendiente" con `programadaPara` seteado (ADR-0009). `components/etiqueta-estado.ts` traduce eso a una etiqueta ("Programada" / "En cola" / "Publicando" / "Publicada" / "Fallida" / "Cancelada"), así una Publicación programada que falló se ve "Fallida" con su `programadaPara` original al lado, nunca se confunde con una que sigue pendiente.
- Componentes nuevos en `components/` (primera vez que el proyecto necesita UI compartida entre rutas): `CuentaFiltroForm` (el form de filtro por Cuenta, reusado por `/publicar` y `/historial`) y `PublicacionResumen` (encabezado + motivo de falla de una fila de Publicación, reusado en los 3 listados que ya existían: Pendientes y Últimas Publicaciones de `/publicar`, y el nuevo historial).
- Se agregaron enlaces cruzados: dashboard → Historial, `/publicar` → "Ver historial completo".
- Pasó por `/code-review` (Standards + Spec) contra el punto de partida del ticket 05 (`689d1eb`):
  - **Spec, corregido**: `lib/meta/client.ts` propagaba a veces un mensaje de error "pelado" (`Graph API respondió 400`, sin más contexto, cuando Meta no manda `error.message`) — exactamente lo que el ticket pide evitar. Ahora todo error de la Graph API se envuelve con un prefijo consistente ("Meta rechazó la solicitud: ...") y el caso sin mensaje dice explícitamente que no hay más detalle en vez de mostrar solo el código HTTP.
  - **Standards, corregido**: `/historial` duplicaba el markup del filtro por Cuenta y de cada fila de Publicación que ya existían en `/publicar` (con inconsistencias de estilo entre medio) — se extrajeron a los dos componentes compartidos de arriba, y de paso las 3 listas ahora muestran la misma etiqueta de estado en vez de que una mostrara el enum crudo y otra un texto armado a mano.
  - **Standards, ancho de página inconsistente**: `/historial` había quedado en `max-w-3xl` sin motivo, distinto a `/publicar` y `/cuentas` (`max-w-2xl`) — unificado.

**Pendiente — mismo bloqueo real que los tickets 03/04/05:** falta crear las credenciales de Google Cloud (Picker) y el bucket de Supabase Storage — wizard ya armado, ver Avance del ticket 03.
