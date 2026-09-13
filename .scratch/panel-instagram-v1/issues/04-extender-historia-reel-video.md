# 04: Extender a Historia, Reel y video

**What to build:** El mismo flujo del ticket 03 pero cubriendo también Historia y Reel, y aceptando archivos de video además de imagen — incluyendo la espera a que Meta termine de procesar el video antes de darlo por publicado.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] El selector de tipo de Publicación permite elegir Post, Historia o Reel antes de publicar.
- [ ] El Publicador acepta archivos de video (además de imagen) para los tres tipos donde aplica.
- [ ] Para video/Reel, el Publicador espera (poll del estado del contenedor en la Graph API) a que Meta termine de procesar el archivo antes de publicar — nunca reporta éxito mientras Meta todavía lo está procesando.
- [ ] Si el archivo de video no cumple los requisitos de Instagram (formato, duración, etc.), el panel avisa antes de intentar publicar.
- [ ] Historia y Reel quedan registrados con el mismo mecanismo de resultado que el Post del ticket 03.
- [ ] Los nuevos casos (video, Historia, Reel, "todavía procesando" de Meta) se cubren con fakes de `MetaClient`, sin pegar contra la API real.
