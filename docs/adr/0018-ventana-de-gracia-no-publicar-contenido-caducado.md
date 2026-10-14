# Ventana de gracia: lo que no salió a su hora no sale solo, tarde

Hasta acá, cualquier Publicación `pendiente` con `programadaPara` en el pasado salía en el próximo tick (`decidirVencidas`), y una Idea `enDrive` con fecha pasada se promocionaba igual (`decidirIdeasParaPromover`), sin importar cuánto hacía que había vencido. Si el panel estaba caído un día, o una Publicación quedaba trabada, al volver publicaba contenido viejo en la Cuenta sin que nadie lo decidiera.

Decisión: una hora programada **caduca** pasadas 2 horas (`lib/scheduler/caducadas.ts`).
- Una Idea caducada no se promociona; queda `enDrive` y la UI la marca "Atrasada" (`esAtrasada`). Reprogramarla es una decisión explícita de Bautista.
- Una Publicación pendiente caducada se pasa a `fallida` con la razón a la vista (y se libera su archivo en Storage), en vez de quedar pendiente para siempre o publicarse tarde.
- Publicar "ahora" (`programadaPara` nulo, ADR-0009) no caduca nunca: es una orden explícita en ese momento.
- Por MCP (ADR-0017) no se acepta una fecha pasada; "publicar ya" es programar unos minutos adelante.

Por qué 2 horas y no menos: la cola es secuencial (ADR-0005) y un mes calendarizado de una sentada suele tener muchos elementos a la misma hora; la ventana tiene que cubrir ese backlog sin descartar el final de la fila.

Consecuencia: una Idea cuya Publicación caducó queda con una Publicación `fallida` vinculada, igual que cuando Meta rechaza una — no se puede re-promocionar la misma Idea (ADR-0013). Hay que duplicarla o recrearla.
