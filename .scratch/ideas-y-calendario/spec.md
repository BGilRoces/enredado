# Ideas + Calendario de contenido

Status: ready-for-agent

## Problem Statement

Hoy el panel sólo cubre el último paso de publicar: elegir un archivo ya terminado en Drive y subirlo. No hay ningún lugar para anotar una idea de contenido antes de que el archivo exista — título, de qué se trata, guión, en qué video de referencia se basa — ni forma de ir avanzándola (guionada, grabada, subida a Drive) hasta dejarla lista para salir en una fecha y hora concretas, por Cuenta de Instagram.

## Solution

Un notebook de Ideas por Cuenta, con estado idea → guionada → grabada → enDrive, hasta 2 links de referencia, y un calendario mensual. Calendarizar una Idea (ponerle fecha/hora) nunca la duplica en un segundo registro — lista y calendario muestran la misma fila. Una vez que la Idea está `enDrive` (con el link real del archivo) y llega su hora, se publica sola a la Cuenta que corresponda, sin que Bautista tenga que estar con el navegador abierto en ese momento — para eso se suma acceso a Google Drive del lado del servidor (OAuth offline, un token propio guardado y minteado bajo demanda), que baja el archivo recién cerca de la hora programada en vez de al calendarizar, para no acumular Storage cuando se planifica mucho contenido de una sentada.

## User Stories

1. Como Bautista, quiero anotar una idea de contenido (título, mini-descripción, guión) desde el celu o la compu, para no perderla.
2. Como Bautista, quiero sumarle a una idea hasta 2 links de referencia (por ejemplo el video en el que se basa), para no perder el contexto de dónde salió.
3. Como Bautista, quiero que cada idea sea de una Cuenta de Instagram puntual, para que el notebook quede separado por cuenta.
4. Como Bautista, quiero avanzar una idea por estados (idea → guionada → grabada), para llevar registro de en qué etapa de producción está.
5. Como Bautista, quiero pegarle a una idea el link de Drive del archivo ya subido y marcarla "en Drive", para dejarla lista para programar.
6. Como Bautista, quiero calendarizarle a una idea una fecha y hora, sin que eso la duplique en un registro aparte, para verla tanto en una lista como en un calendario mensual.
7. Como Bautista, quiero poder calendarizar una idea aunque todavía no esté en Drive, para usarlo como recordatorio de cuándo la necesito lista.
8. Como Bautista, quiero que si llega la hora programada y la idea no llegó a estar en Drive, quede marcada como atrasada en vez de publicarse igual o fallar silenciosamente.
9. Como Bautista, quiero que una idea en Drive y calendarizada se publique sola a la hora indicada, sin tener que estar yo con el navegador abierto en ese momento.
10. Como Bautista, quiero ver el listado de ideas filtrado por Cuenta y por estado, igual que ya puedo filtrar el historial de Publicaciones.
11. Como Bautista, quiero ver un calendario mensual con las ideas programadas de cada día, para planificar de un vistazo.

## Implementation Decisions

- Ver ADR-0013 (Idea es la fila durable, la Publicación real se crea recién al promocionar), ADR-0014 (acceso a Drive del lado del servidor, OAuth offline + refresh token cifrado) y ADR-0015 (preparar lazy para Publicaciones de Ideas, carve-out puntual sobre ADR-0009).
- Reuso explícito del motor existente: una vez promocionada, la Publicación la controla el mismo Publicador/Cola/Scheduler de siempre, sin cambios en `decidirVencidas`/`decidirSiguiente`/`publicarDesdeStorage`.
- Acceso scoped por Cuenta con el mismo mecanismo de Colaboradores ya existente (`asegurarAccesoACuenta`/`obtenerCuentaIdPermitida`).
- Sin librería de calendario nueva — grilla mensual armada a mano (`lib/calendario/mes-en-grilla.ts`), coherente con que el resto del panel no usa ningún kit de componentes.

## Testing Decisions

- Mismo criterio que el resto del panel (ver `.scratch/panel-instagram-v1/spec.md`): tests reales sólo sobre funciones puras o módulos con clientes inyectados — `decidir-ideas-para-promover.ts`, `es-atrasada.ts`, `parsear-drive-file-id.ts`, `mes-en-grilla.ts`, `preparar-si-hace-falta.ts`, más los análogos de OAuth (`oauth-url.ts`, `callback-outcome.ts`) que ya tienen tests para el flujo de Meta.
- El resto (server actions, workers en sí, rutas OAuth) queda sin test unitario — se verifica con una corrida real de punta a punta (issue 07), igual que el resto del motor de publicación hoy.

## Out of Scope

- Carousels desde una Idea (una Idea = un archivo). Si hace falta más adelante, es una extensión sobre el mismo modelo, no un rediseño.
- Notificaciones más allá del badge "atrasada" en la UI (no hay SMTP en `shared-infra`, mismo motivo que el spec original).
- Reordenar/arrastrar en el calendario — para mover una fecha se edita la Idea.

## Further Notes

- Ver ADR-0013/0014/0015, y ADR-0001 a 0012 para el resto de las decisiones del motor de publicación existente.
- `CONTEXT.md` necesita una entrada de glosario para "Idea" y "promocionar" una vez implementado.
- El paso de conseguir `GOOGLE_CLIENT_SECRET` en Google Cloud Console y hacer el consentimiento offline en `/configuracion` es manual, sólo lo puede hacer Bautista — bloquea probar el flujo real de principio a fin (issue 07).
