# 03: Publicar un Post inmediato con imagen (Drive → Instagram)

**What to build:** El camino feliz completo pero angosto: elegir una imagen con el Google Picker, elegir la Cuenta de Instagram destino, escribir un caption, y publicarla ya mismo como Post real en Instagram. Primera vez que el Publicador funciona de punta a punta (Drive → Storage temporal → Meta → registro del resultado).

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Selector de Google Drive (Google Picker API) integrado en el panel; devuelve el archivo elegido sin listar/sincronizar todo el Drive del lado del servidor.
- [ ] El usuario elige la Cuenta de Instagram destino entre las conectadas, y escribe un caption.
- [ ] Al confirmar, el Publicador baja la imagen de Drive, la sube temporalmente a un bucket de Supabase Storage en `shared-infra`, genera la URL pública, crea el contenedor de media en la Graph API y lo publica.
- [ ] El archivo temporal se borra de Storage una vez que Meta confirma la publicación (éxito o fallo definitivo).
- [ ] Si el archivo no es un formato de imagen soportado por Instagram, el panel avisa antes de intentar publicar (sin gastar una llamada a Meta).
- [ ] El resultado (publicado / falló, con motivo si falló) queda registrado y visible en el panel, aunque sea de forma mínima (todavía no es el historial completo del ticket 06).
- [ ] El Publicador se testea con fakes de `DriveClient`, `MetaClient` y `StorageClient` — ningún test pega contra Drive/Meta/Supabase reales.
