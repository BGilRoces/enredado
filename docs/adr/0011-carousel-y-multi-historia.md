# Carousel como tabla hija; Historia con varias fotos = varias Publicaciones

Hasta ahora el Picker sólo dejaba elegir un archivo de Drive por Publicación. Bautista quiere elegir varias fotos a la vez, tanto para Post (subidas como carousel) como para Historia.

La Graph API de Instagram no tiene equivalente de "carousel" para Historias — cada Historia es siempre un único media. Elegir N fotos para Historia no puede convertirse en una sola llamada a Meta: se resuelve creando **N Publicaciones independientes**, una por foto, cada una procesada por la cola existente sin ningún cambio en ese camino. Post, en cambio, sí tiene soporte real de carousel en la Graph API (2 a 10 elementos: contenedores hijos con `is_carousel_item=true`, después un contenedor padre `media_type=CAROUSEL` con `children`).

Para modelar el carousel en `Publicacion` había dos opciones: guardar la lista de archivos como JSON/array en la propia fila, o una tabla hija `PublicacionArchivo` (uno por elemento, con `orden`). Elegimos la tabla hija porque cada elemento necesita su propio `driveFileId`/`tipoMedia`/`storageUrl` — los mismos campos que ya tiene `Publicacion` para el caso simple — y así el borrado de Storage (`storageClient.borrar`, hoy por `driveFileId`) no cambia de forma, sólo pasa a iterar sobre varias filas en vez de una.

El caso simple (Historia, Reel, o Post de un solo archivo) sigue usando los campos sueltos de `Publicacion` (`driveFileId`, `tipoMedia`, `storageUrl`) exactamente como antes — no se tocó ese camino. Una Publicación es carousel si y sólo si tiene filas en `archivos`; no se agregó un enum ni un flag nuevo porque la presencia de hijos ya es la señal.
