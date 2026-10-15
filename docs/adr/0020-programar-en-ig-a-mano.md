# El panel organiza, la programación en Instagram se hace a mano

La Graph API oficial no permite elegir un audio de la biblioteca de Instagram al publicar un Reel o un carousel. Ese audio es lo que hace que el contenido aparezca en la sección de Reels y en la página del sonido, así que es indispensable para Bautista. Hornear un mp3 en el video no lo reemplaza, y la API no oficial (instagrapi) viola los términos de IG y pone en riesgo las cuentas.

Decisión: el panel deja de publicar. Los workers del Publicador (ADR-0004) y de promoción de Ideas (ADR-0013) ya no se arrancan (`instrumentation.ts`); el código y las tablas `Publicacion` quedan por el historial y por si se retoma. Todo sigue naciendo como Idea; una Idea `enDrive` con fecha es contenido listo, y lo único que falta es programarlo en la app de Instagram (donde sí se elige el audio).

- `Idea.programadaEnIgEl` (nulo = "falta programar en IG"): lo marca el dueño en `/ideas/[id]` o Claude por MCP (`marcar_programada_en_ig`). Cambiar la fecha o descalendarizar lo vuelve a nulo, porque lo agendado en la app quedó con la hora vieja.
- `Idea.audio`: nombre del audio de la biblioteca de IG, nota para quien la programa.
- El dashboard y `/ideas?faltaIg=1` listan lo pendiente.
- `/publicar` redirige a `/ideas/nueva`; se retiran `crearPublicacion` y `cancelarPublicacion`.
- La migración cancela las Publicaciones `pendiente`/`bloqueadaPorLimite`, que nadie iba a procesar. Las Ideas vinculadas pasan a "falta programar en IG".

ADR-0018 (ventana de gracia) y ADR-0019 (toda Publicación pertenece a una Idea) quedan sin efecto práctico. La renovación de tokens de Meta se mantiene sólo para no mostrar cuentas con alerta de reconexión.
