# Toda Publicación pertenece a una Idea

/publicar creaba la Publicación directo, sin Idea (ADR-0013 sólo cubría Ideas → Publicación). Resultado: dos lugares para lo mismo — una Publicación programada desde /publicar no aparecía en Ideas ni en el calendario, y editar la hora/caption había que hacerlo en pantallas distintas según de dónde había salido.

Decisión: `Idea` es la única entidad que el usuario ve y edita; `Publicacion` es el detalle de ejecución del worker. `crearPublicacion` (/publicar) ahora crea primero una Idea `enDrive` (título = primera línea del caption, ver `tituloDesdeCaption`) y vincula a ella las Publicaciones que crea. La Idea nace sin `programadaPara` y recibe la fecha (o "ahora") recién cuando las Publicaciones ya existen, para que el worker de Ideas no la promueva en el medio de la preparación del archivo. El camino eager de ADR-0009 no cambia: las Publicaciones se siguen creando ya preparadas y, como traen `storageUrl`, `procesarUna` no re-prepara (ADR-0015 sólo actúa si falta el archivo preparado).

La pantalla /publicar queda como formulario rápido + lista de pendientes que linkea a /ideas/[id], donde se edita fecha, caption o se cancela. Se retira `editarPublicacion`. Una migración vincula a una Idea las Publicaciones viejas sin `ideaId`.
