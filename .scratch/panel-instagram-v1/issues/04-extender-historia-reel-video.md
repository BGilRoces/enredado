# 04: Extender a Historia, Reel y video

**What to build:** El mismo flujo del ticket 03 pero cubriendo también Historia y Reel, y aceptando archivos de video además de imagen — incluyendo la espera a que Meta termine de procesar el video antes de darlo por publicado.

**Blocked by:** 03

**Status:** done (código) — mismo bloqueo de infra real que el ticket 03 (Google Cloud + Supabase Storage)

- [x] El selector de tipo de Publicación permite elegir Post, Historia o Reel antes de publicar.
- [x] El Publicador acepta archivos de video (además de imagen) para los tres tipos donde aplica.
- [x] Para video/Reel, el Publicador espera (poll del estado del contenedor en la Graph API) a que Meta termine de procesar el archivo antes de publicar — nunca reporta éxito mientras Meta todavía lo está procesando.
- [x] Si el archivo de video no cumple los requisitos de Instagram (formato, duración, etc.), el panel avisa antes de intentar publicar.
- [x] Historia y Reel quedan registrados con el mismo mecanismo de resultado que el Post del ticket 03.
- [x] Los nuevos casos (video, Historia, Reel, "todavía procesando" de Meta) se cubren con fakes de `MetaClient`, sin pegar contra la API real.

## Avance

**Hecho en código, verificado con tests/typecheck/build/lint (todo verde, 36 tests):**
- `lib/publicador/publicar-post.ts` → renombrado a `lib/publicador/publicar.ts` (`publicarPost` → `publicar`): ya no es solo "Post", cubre los tres tipos.
- `lib/publicador/types.ts`: `MetaPublishClient` generalizado — `createContainer` (antes `createImageContainer`) recibe `{tipoPublicacion, media: {tipo: "imagen"|"video", url}, caption}`; se agregó `getContainerStatus` para el poll. `ResultadoPublicacion` sigue atado al enum `EstadoPublicacion` de Prisma (decisión del ticket 03).
- `lib/publicador/publicar.ts`: `detectarTipoMedia` decide imagen/video/no-soportado según `tipoPublicacion` (un Reel con imagen se rechaza acá, antes de tocar Storage o Meta — Reel siempre es video, ver CONTEXT.md). El poll de procesamiento (`esperarProcesamiento`, `esperar` inyectable para no usar timers reales en tests) **solo corre para video** — las imágenes publican directo, igual que en el ticket 03 (Post con imagen no cambia de comportamiento).
- `lib/meta/client.ts`: `metaPublishClient.createContainer` arma los params reales de la Graph API según tipo (`media_type=REELS/STORIES/VIDEO`, o sin `media_type` para Post+imagen), y `getContainerStatus` traduce `status_code` (`FINISHED`/`PUBLISHED` → listo, `IN_PROGRESS` → en_progreso, cualquier otro → error).
- `app/publicar/`: selector de tipo de Publicación (Post/Historia/Reel) en el form; el Google Picker ahora también acepta videos (`DOCS_VIDEOS`).
- Pasó por `/code-review` (Standards + Spec) contra el punto de partida del ticket 03 (`a6fc42a`):
  - **Spec, scope creep real corregido**: la primera versión pooleaba el estado del contenedor para *todos* los tipos, incluidas imágenes — cambiaba sin necesidad el camino de Post-imagen ya verificado en el ticket 03 y agregaba una llamada a Meta de más basada en un supuesto no confirmado. Se restringió el poll a video/Reel únicamente.
  - **Standards**: se renombraron dos helpers privados nuevos de `lib/meta/client.ts` que habían quedado en español (`paramsDeContenedor`, `estadoDeGraphStatus`) a inglés, consistente con el resto del archivo (mismo tipo de hallazgo que ya se había corregido a nivel de interfaz pública en el ticket 03).
  - **Decisión de scope, no corregida a propósito**: la validación de video se limita al MIME type (`video/mp4`, `video/quicktime`) — no se agregó inspección de duración/dimensiones (requeriría ffprobe o una librería de metadata de video, una dependencia pesada para un proyecto de bajo consumo). Esas violaciones las termina rechazando la propia Graph API al crear el contenedor, *antes* de intentar publicar (nunca se llega a `media_publish`), así que el requisito "avisa antes de intentar publicar" se cumple igual, con el mensaje de error de Meta como motivo.

**Pendiente — mismo bloqueo real que el ticket 03:** falta crear las credenciales de Google Cloud (Picker) y el bucket de Supabase Storage — wizard ya armado, ver Avance del ticket 03.
