# 05: Notebook — listado

**What to build:** Rutas de alta rápida, edición y listado filtrable del notebook de Ideas.

**Blocked by:** 04

**Status:** done

- [x] `app/ideas/page.tsx` — listado, `CuentaFiltroForm` + filtro de estado.
- [x] `app/ideas/nueva/page.tsx` — alta rápida.
- [x] `app/ideas/[id]/page.tsx` — edición completa, botones de estado, pegar link de Drive, calendarizar.
- [x] `components/idea-fila-expandible.tsx`.
- [x] Nav "Ideas" en `components/app-shell.tsx`.

## Avance

`/ideas/[id]` bloquea la edición de estado/link de Drive una vez promocionada (`publicacionId` seteado) — título/descripción/guión/links/caption siguen editables siempre como notas, y el caption se re-sincroniza a la Publicación vinculada mientras siga pendiente (ver issue 04). `/configuracion` (issue 02) no se sumó al nav principal a propósito: es sólo para el dueño del panel, no para Colaboradores, y no se plomeó `cuentaIdPermitida` hasta `AppShell` para ese único caso — queda alcanzable por URL directa desde `/cuentas` (patrón ya existente para "Conectar cuenta").
