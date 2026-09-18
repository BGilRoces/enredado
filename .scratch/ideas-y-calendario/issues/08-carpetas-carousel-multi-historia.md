# 08: Carpetas de Drive → carousel / multi-Historia, con orden elegible

**What to build:** Marcar "en Drive" con el link de una carpeta entera, no sólo un archivo — Post arma un carousel, Historia sube varias seguidas — con el orden de los archivos elegible en el panel (subir/bajar).

**Blocked by:** 01–06 (feature original de Ideas), 02 (necesita Drive conectado para listar la carpeta)

**Status:** done (código) — sin probar contra infra real todavía

- [x] `IdeaArchivo` (tabla nueva, con `orden`/`nombre`) + relación Idea↔Publicación pasa de 1:1 (`Idea.publicacionId`) a 1:N (`Publicacion.ideaId`).
- [x] `Publicacion`/`PublicacionArchivo` suman `driveResourceKey`; `PublicacionArchivo.tipoMedia`/`storageUrl` pasan a nullable (camino lazy).
- [x] `lib/drive/listar-carpeta.ts` — lista una carpeta con el token del servidor.
- [x] `lib/ideas/parsear-drive-file-id.ts` — `parsearDriveFolderId`.
- [x] `app/ideas/actions.ts` — `marcarEnDrive` maneja archivo o carpeta (Reel rechaza carpeta); nueva `moverArchivoIdea` (swap con el vecino).
- [x] `lib/ideas/promover-idea.ts` — 3 caminos: archivo único, carousel (Post), N Publicaciones independientes (Historia).
- [x] `lib/publicador/preparar-si-hace-falta.ts` — ahora agnóstico de la Idea, prepara simple o carousel según lo que traiga la Publicación.
- [x] `lib/worker/publicador-worker.ts` — `procesarUna` prepara lazy también para carousels de una Idea.
- [x] `components/etiqueta-estado-idea.ts` — agrega el badge cuando hay más de una Publicación vinculada.
- [x] `app/ideas/[id]/page.tsx` — UI de reordenar (subir/bajar), lista de Publicaciones cuando son varias.
- [x] ADR-0016.

## Avance

`npx tsc --noEmit`, lint y `npx vitest run` (103 tests) limpios; `next build` genera todas las rutas sin error. Migración generada y aplicada contra la base real (ver detalle en el commit).

Decisiones tomadas en el camino, no anticipadas por el plan original:
- **Reel + carpeta se rechaza de entrada** en `marcarEnDrive` (no se intenta "tomar el primero"): un Reel es siempre un solo video, dejar pasar una carpeta ahí sólo generaría sorpresas sobre cuál archivo se eligió.
- **Post + carpeta con exactamente 1 archivo soportado** no arma un carousel de 1 elemento (Instagram no lo acepta) — se promociona como Publicación simple, mismo camino que un archivo suelto.
- **`prepararSiHaceFalta` se independizó de `Idea`**: ya no lee `driveFileId`/`driveResourceKey` a través de la relación `idea` — los lee directo de la Publicación (o de sus `archivos`), copiados ahí al promocionar. Esto es lo que permitió soportar el carousel sin duplicar lógica: la función no necesita saber si el origen fue un archivo único o una carpeta.
- **`descalendarizarIdea` desvincula (`ideaId: null`) las Publicaciones canceladas** en vez de borrarlas, para que la Idea quede libre de promocionarse de nuevo — mismo criterio que antes, adaptado a que ahora puede haber varias.
