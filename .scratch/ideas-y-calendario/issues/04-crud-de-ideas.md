# 04: CRUD de Ideas

**What to build:** Server actions para todo el ciclo de vida de una Idea, mismo estilo que `app/publicar/actions.ts`.

**Blocked by:** 01, 03

**Status:** done

- [x] `app/ideas/actions.ts`: `crearIdea`, `actualizarIdea`, `marcarEnDrive`, `cambiarEstadoIdea`, `calendarizarIdea`, `descalendarizarIdea`, `eliminarIdea` — todas con `asegurarAccesoACuenta`.
- [x] `components/etiqueta-estado-idea.ts` — badges por `EstadoIdea`, delegando al badge de la Publicación vinculada una vez promocionada.

## Avance

`descalendarizarIdea` y `eliminarIdea` reusan `cancelarPublicacion` de `app/publicar/actions.ts` en vez de reimplementar la limpieza de Storage. `calendarizarIdea` sobre una Idea ya promocionada actualiza también la `Publicacion` vinculada (sólo si sigue `pendiente`, mismo guard `updateMany` que `editarPublicacion`) para que fecha de la Idea y fecha real de la Publicación nunca queden desalineadas.
