# Bajar de Drive y subir a Storage al crear la Publicación, no al publicarla

> Esta regla sigue aplicando tal cual para `/publicar` (Picker interactivo). Para Publicaciones que nacen de una Idea promocionada, ver el carve-out puntual de [ADR-0015](0015-preparar-lazy-para-publicaciones-de-ideas.md).

El token de Google que autoriza la descarga del archivo de Drive (el que entrega el Picker, scope `drive.file`) dura ~1 hora. Hasta el ticket 04, el Publicador bajaba de Drive y publicaba en el mismo paso, siempre de inmediato — ese token nunca llegaba a expirar.

El ticket 05 agrega Publicaciones programadas para un momento futuro (horas o días después). Si el Publicador siguiera bajando de Drive recién al momento de publicar, cualquier Publicación programada para más de ~1 hora después fallaría siempre: el token de Drive guardado en la Publicación ya habría vencido, y sin pedirle a Bautista que vuelva a autorizar Drive no hay forma de renovarlo solo.

Decidimos partir el Publicador en dos pasos:
- **Preparar** (`prepararArchivo`, corre al crear la Publicación — sea "ahora" o programada): baja de Drive con el token todavía fresco, valida el formato, y sube a Supabase Storage. El resultado (`tipoMedia`, URL pública de Storage) se guarda en la fila de la Publicación.
- **Publicar** (`publicarDesdeStorage`, corre cuando el scheduler/cola la dispara, sea al toque o días después): ya no depende del token de Drive — crea el contenedor en la Graph API a partir de la URL de Storage ya subida, espera el procesamiento si es video, publica, y borra el temporal.

Por qué: el token de Meta de la Cuenta (que sí dura ~60 días y se renueva, ver ticket 07) es el único que necesita seguir siendo válido al momento real de publicar. El archivo ya expuesto en Storage no tiene fecha de vencimiento propia — quien maneja su ciclo de vida es el propio panel (se borra recién cuando Meta confirma la publicación, éxito o fallo). El costo es dejar el archivo en Storage más tiempo del estrictamente necesario para Publicaciones programadas lejos en el futuro, aceptable para el volumen de este panel.
