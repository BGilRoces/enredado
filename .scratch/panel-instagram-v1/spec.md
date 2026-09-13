# Panel de gestión multi-Instagram (v1)

Status: ready-for-agent

## Problem Statement

Bautista administra varias Cuentas de Instagram propias y necesita subir contenido (fotos y videos) desde Google Drive a esas cuentas, como Post, Historia o Reel, sin tener que abrir la app de Instagram y buscar el archivo a mano cada vez. Hoy no existe ningún panel central: cada subida es un proceso manual, cuenta por cuenta. A futuro además quiere poder delegar la publicación de ciertas Cuentas a otras personas (Colaboradores) sin darles acceso a todas.

## Solution

Un panel propio en Next.js, alojado en el VPS existente (proyecto Coolify `enredado`), que centraliza las Cuentas de Instagram conectadas, deja elegir un archivo de Google Drive y publicarlo como Post, Historia o Reel en la Cuenta elegida — de inmediato o como Publicación programada — usando exclusivamente la API oficial de Meta (Graph API / Content Publishing). Esta v1 es de un solo usuario (Bautista); el modelo de Colaboradores con acceso restringido por Cuenta queda para una fase posterior, como feature aparte, sin migración de datos.

## User Stories

1. Como Bautista, quiero conectar una Cuenta de Instagram (Business/Creator + Página de Facebook) al panel, para poder publicarle contenido desde ahí.
2. Como Bautista, quiero ver la lista de Cuentas de Instagram ya conectadas, para saber a cuáles les puedo publicar.
3. Como Bautista, quiero desconectar una Cuenta de Instagram del panel, para dejar de operarla desde ahí sin borrar su historial de Publicaciones.
4. Como Bautista, quiero loguearme al panel con usuario y contraseña, para que nadie más pueda usarlo sin permiso.
5. Como Bautista, quiero elegir un archivo de imagen o video desde mi Google Drive usando el selector nativo de Google, para no tener que descargarlo a mano antes de subirlo.
6. Como Bautista, quiero elegir a qué Cuenta de Instagram va dirigido el archivo elegido, para publicarlo en la cuenta correcta.
7. Como Bautista, quiero elegir si el archivo se publica como Post, como Historia o como Reel, para que termine en el lugar correcto de Instagram.
8. Como Bautista, quiero escribir un caption para un Post o un Reel antes de publicarlo, para darle contexto al contenido.
9. Como Bautista, quiero publicar de inmediato, para que el contenido salga en el momento en que lo decido.
10. Como Bautista, quiero programar una Publicación para una fecha y hora futura, para dejar contenido preparado con anticipación.
11. Como Bautista, quiero ver la lista de Publicaciones programadas pendientes por Cuenta, para saber qué va a salir y cuándo.
12. Como Bautista, quiero cancelar o editar una Publicación programada antes de que salga, para corregir errores o cambios de planes.
13. Como Bautista, quiero ver el historial de Publicaciones ya hechas (Cuenta, tipo, fecha, resultado), para tener un registro de lo que se subió y cuándo.
14. Como Bautista, quiero que si una Publicación falla (por ejemplo, la API de Meta la rechaza), el panel me muestre el error de forma clara, para poder corregir el problema y reintentar.
15. Como Bautista, quiero que las Publicaciones se procesen de a una por vez, para que un video pesado no le saque recursos al resto de mis sitios en el mismo VPS.
16. Como Bautista, quiero que el archivo de Drive se exponga solo temporalmente en una URL pública para que Meta lo descargue, y se borre apenas termina de usarse, para no dejar contenido privado accesible para siempre.
17. Como Bautista, quiero que el panel respete el límite de publicaciones diarias que impone la API de Meta por Cuenta, para no romper una Cuenta real por exceso de llamadas.
18. Como Bautista, quiero que si subo un video o Reel, el panel espere a que Meta termine de procesarlo antes de darlo por publicado, para no reportar éxito cuando Instagram todavía lo está procesando.
19. Como Bautista, quiero que cada Cuenta guarde su propio token/credencial de Meta de forma privada, para poder operar varias Cuentas sin mezclarlas.
20. Como Bautista, quiero que si elijo un archivo con un formato no soportado por Instagram, el panel me avise antes de intentar publicar, para no gastar una llamada a la API en algo que va a fallar seguro.
21. Como Bautista, quiero que el panel renueve el token de Meta de cada Cuenta antes de que venza (los long-lived tokens duran ~60 días), para no tener que reconectar la cuenta a mano sin darme cuenta.
22. Como Bautista, quiero ver dentro del panel si una Publicación programada falló, para enterarme sin tener que revisar todo el historial (no hay email porque no hay SMTP configurado en la infra compartida).

## Implementation Decisions

- **Módulos centrales** (el "motor de publicación", los tres seams acordados):
  - **Publicador**: recibe una Publicación resuelta (Cuenta + tipo + archivo) y clientes inyectados (`DriveClient`, `MetaClient`, `StorageClient`); ejecuta bajar de Drive → subir a Storage temporal → crear contenedor en Meta → esperar procesamiento (video/Reel) → publicar → borrar el archivo temporal de Storage.
  - **Cola de publicación**: función pura que decide, dado el estado actual (una Publicación en curso o no) y las Publicaciones pendientes, cuál sigue. Procesa una por vez (ADR-0005), nunca en paralelo.
  - **Scheduler**: función pura que, dada la hora actual y las Publicaciones programadas, decide cuáles ya vencieron y deben pasar a la Cola (ADR-0004). Corre como intervalo en memoria dentro del mismo proceso Next.js, sin cron de sistema ni cola externa.
- **Base de datos**: Postgres de `shared-infra`, schema propio `enredado` (ADR-0002, ADR-0003). Entidades principales: Cuenta de Instagram (credenciales/token de Meta, vencimiento del token) y Publicación (Cuenta, tipo Post/Historia/Reel, referencia al archivo de Drive, caption, estado, momento programado si aplica, resultado/error).
- **Auth**: Supabase Auth (GoTrue) de la misma instancia `shared-infra`. V1 de un solo usuario, sin confirmación por mail (no hay SMTP configurado en `shared-infra`).
- **Selección de Drive**: Google Picker API del lado del cliente (OAuth de Google) — el panel recibe el id/metadata del archivo elegido, sin listar ni sincronizar el Drive completo del lado del servidor.
- **Exposición pública para Meta**: bucket de Supabase Storage en `shared-infra`, usado como almacenamiento temporal (se sube al momento de publicar, se borra al terminar).
- **Integración con Meta**: Graph API / Content Publishing exclusivamente (ADR-0001) — flujo de contenedor (`.../media`) + publish (`.../media_publish`); para video/Reel, poll del estado del contenedor hasta que Meta termine de procesarlo antes de publicar.
- **Hosting**: nuevo proyecto Coolify `enredado` (ADR-0003), deploy vía GitHub Actions + API de Coolify (mismo patrón que el resto de los proyectos del VPS), dominio auto-generado de Coolify en v1.

## Testing Decisions

- Los tests de valor real son sobre los tres módulos del motor de publicación (Publicador, Cola, Scheduler), no sobre rutas de Next.js ni UI.
- Publicador: se testea con fakes de `DriveClient`, `MetaClient` y `StorageClient` — se verifica el comportamiento observable (qué llamadas hace a cada cliente y en qué orden, cómo reacciona a que Meta devuelva error o "todavía procesando"), nunca contra las APIs reales.
- Cola y Scheduler: funciones puras, se testean con datos armados a mano (listas de Publicaciones, "ahora" fijo), sin timers ni reloj real.
- No hay tests previos en este repo (proyecto nuevo) — no hay prior art local que seguir; cada seam se construye con el ciclo rojo-verde-refactor de `/tdd`.
- Las rutas/UI de Next.js se testean, si acaso, de forma liviana: que invocan al módulo correcto con los argumentos correctos. El grueso del valor de test vive en los tres módulos de arriba.

## Out of Scope

- Colaboradores con acceso restringido por Cuenta (fase posterior; Supabase Auth ya deja el terreno preparado para sumarlo sin migrar datos).
- Dominio propio para el panel (arranca con el subdominio auto-generado de Coolify).
- Notificaciones por email (no hay SMTP configurado en `shared-infra`).
- Backups de base de datos (el VPS entero no tiene backups configurados hoy; está fuera del alcance de este spec puntual).
- Automatización no oficial de Instagram (descartado explícitamente en ADR-0001).
- Analytics o métricas de rendimiento de las Publicaciones (solo se registra si se publicó o falló, no engagement, alcance, etc.).

## Further Notes

- Ver `docs/adr/0001` a `0005` para el razonamiento detrás de cada decisión técnica de este spec.
- Ver `CONTEXT.md` para el glosario del proyecto (Cuenta de Instagram, Publicación, Post, Historia, Reel, Publicación programada, Colaborador).
- Crear la App de Meta for Developers y agregar cada Cuenta como Instagram Tester es un paso manual que solo puede hacer Bautista en el dashboard de Meta — buen candidato para la skill `/wizard` cuando el ticket correspondiente lo necesite.
- Detalle de la infraestructura del VPS (Coolify, dominios, bases de datos) relevado desde `~/segundo-cerebro/wiki/infraestructura/` al momento de este spec.
