# 02: Conectar una Cuenta de Instagram

**What to build:** Alta de una Cuenta de Instagram en el panel: guarda su token de Meta de forma privada, se puede ver listada, y se puede desconectar sin borrar su historial de Publicaciones (que todavía no existe en este ticket, pero el modelo de datos lo debe permitir a futuro).

**Blocked by:** 01

**Status:** done — verificado de punta a punta en producción (las 4 Cuentas reales conectadas)

- [x] Formulario/flujo para conectar una Cuenta de Instagram (Business/Creator vinculada a una Página de Facebook) usando el login de Meta, guardando el token de acceso de forma privada (nunca visible en la UI ni en logs) — cifrado con AES-256-GCM (ADR-0007).
- [x] Lista de Cuentas de Instagram conectadas, visible en el panel (`/cuentas`).
- [x] Acción para desconectar una Cuenta (elimina/invalida su token, no borra registros históricos asociados) — la fila se conserva con `estado: desconectada`.
- [x] El token de cada Cuenta se guarda de forma aislada por Cuenta — una columna por fila, `igUserId` único.
- [x] Si la conexión con Meta falla (permisos insuficientes, cuenta no es Business/Creator, etc.), el panel muestra un error claro en vez de guardar una Cuenta a medio configurar — probado con fakes, ninguna escritura a la DB ocurre antes de resolver las cuentas.

## Avance

**Hecho en código, verificado con tests/typecheck/build/lint (todo verde):**
- `lib/crypto/token-cipher.ts`: cifra/descifra el token con AES-256-GCM (clave en `TOKEN_ENCRYPTION_KEY`), 5 tests (round-trip, IV al azar, detecta manipulación, error claro si falta la clave).
- `lib/meta/resolve-accounts.ts`: el seam principal — dado un `code` de OAuth y un `MetaClient` inyectado, resuelve todas las Cuentas de Instagram vinculadas a las Páginas autorizadas. 4 tests con un fake client (feliz, páginas sin IG vinculado, sin páginas, error propagado).
- `lib/meta/callback-outcome.ts`: función pura para la decisión del callback (seguir / rechazar por error de Meta o CSRF), mismo patrón que `lib/auth/decide-redirect.ts`. 5 tests.
- `lib/meta/client.ts`: implementación real contra la Graph API (no testeada por sí sola, es el adapter — el contrato que importa es el que testea `resolve-accounts.test.ts`).
- `app/api/meta/connect/route.ts` + `app/api/meta/callback/route.ts`: arman/validan el `state` (CSRF, cookie httpOnly), delegan en `resolveInstagramAccounts`, y hacen el upsert de las Cuentas dentro de una transacción (si falla a mitad de camino con varias cuentas, no queda nada a medio guardar).
- `app/cuentas/page.tsx` + `actions.ts`: lista, conectar, desconectar.
- Prisma: modelo `Cuenta` + enum `EstadoCuenta` nuevos en `prisma/schema.prisma`.
- Pasó por `/code-review` (Standards + Spec): 5 judgement calls de Standards (duplicación de `GRAPH_VERSION`, lógica de CSRF sin extraer, cookie compartida entre rutas, `"conectada"` como string suelto en vez del enum) — los 4 con fix aplicable se corrigieron; 2 hallazgos de Spec (mensaje de error de Meta pasado crudo a la UI, upsert sin transacción) — ambos corregidos.
- **Bug real encontrado después del review, no por el review**: el modelo `Cuenta` se agregó a `schema.prisma` pero nunca se había armado el flujo de migraciones del proyecto — la tabla no existía en la Postgres real, `/cuentas` iba a tirar error en producción. Se agregó `prisma.config.ts` (mismo patrón que `sistemas`, necesario porque nuestro `schema.prisma` no declara `url` a propósito, ver `lib/db/prisma.ts`), la migración inicial en `prisma/migrations/`, y `prisma migrate deploy` corriendo antes de `next start` en cada deploy — ver sección "Migraciones" del README.

**Infra real armada (2026-09-13):** App de Meta for Developers creada (tipo Business), HTTPS activado en el dominio de Coolify, use cases "Manage messaging & content on Instagram" + "Manage everything on your Page" agregados, Login Configuration creada con `pages_show_list`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`, y las 4 Cuentas de Instagram reales agregadas como Tester/Admin. `META_APP_ID`, `META_APP_SECRET`, `META_LOGIN_CONFIG_ID`, `APP_URL` y `TOKEN_ENCRYPTION_KEY` cargadas en Coolify.

**2026-09-13 — hallazgo real durante el wizard:** al crear la App real, el dashboard de Meta ya no ofrece el login clásico de Facebook (`scope` suelto en la URL de OAuth) para apps tipo Business — la asunción original de ADR-0001/este ticket. Ahora exige Facebook Login for Business con una Login Configuration (`config_id`). Se corrigió `lib/meta/oauth-url.ts` (manda `config_id` en vez de `scope`), se agregó `META_LOGIN_CONFIG_ID` a `.env.example`, se actualizó el test correspondiente, y se documentó la decisión en ADR-0008. Typecheck y los 24 tests (ahora con el test de `oauth-url` ajustado) siguen en verde.

**2026-09-13 — segundo hallazgo real, probando contra producción:** con el fix de arriba ya deployado, el login de Meta funcionó (código de autorización real recibido), pero Meta redirigió a `http://localhost:3000/api/meta/callback` en vez del dominio real. Causa: `app/api/meta/connect` y `app/api/meta/callback` armaban su Redirect URI con `new URL("/api/meta/callback", request.url)` — detrás del proxy de Coolify, `request.url` en una Route Handler resuelve al bind interno del contenedor (`localhost:3000`), no al dominio público. Se agregó la env var `APP_URL` (origen público estable, ver `.env.example`) y ambas rutas arman ahora la Redirect URI a partir de esa variable (`lib/meta/config.ts`), no de `request.url`. `proxy.ts` no se tocó: usa `request.nextUrl`, que sí refleja el Host real (ya verificado en producción con el redirect a `/login`). Verificado con typecheck, los 24 tests y `next build` en verde.

**2026-09-13 — cierre:** con `APP_URL` cargada en Coolify, Bautista conectó las 4 Cuentas de Instagram reales desde el dominio de producción. Ticket 02 cerrado de punta a punta, incluida la infra real.
