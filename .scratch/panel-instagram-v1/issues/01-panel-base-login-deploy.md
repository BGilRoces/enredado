# 01: Panel base: login + deploy real

**What to build:** El proyecto Coolify `enredado` desplegado en el VPS compartido (dominio auto-generado de Coolify), con el schema `enredado` creado en la Postgres de `shared-infra`, y login funcionando vía Supabase Auth de esa misma instancia. Al terminar existe un panel vacío pero real, online, protegido por contraseña, deployado con el mismo mecanismo (GitHub Actions → SSH → API de Coolify) que el resto de los proyectos del VPS.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Repo Next.js nuevo, privado, en la cuenta de GitHub existente.
- [ ] Proyecto `enredado` creado en Coolify, con su propio contenedor, buildeado directo del repo (sin GHCR).
- [ ] Workflow de GitHub Actions que deploya en cada push a main, siguiendo el mismo patrón (SSH + curl a la API de Coolify) que `tropero`/`saume-next`/`bertha-next`.
- [ ] Schema `enredado` creado en la Postgres de `shared-infra`, sin tocar los schemas de otros proyectos (`liso`, `public`, etc.).
- [ ] Login con usuario/contraseña vía Supabase Auth (GoTrue) de `shared-infra`, sin confirmación por mail (no hay SMTP configurado).
- [ ] Una ruta protegida (dashboard vacío) que solo se ve logueado; sin sesión, redirige al login.
- [ ] Una sesión válida de Supabase Auth pero sin `app_metadata.app = "enredado"` (por ejemplo, un usuario de `sistemas` u otra app que comparte `shared-infra`) se trata como no autenticada, nunca como acceso válido a este panel (ver ADR-0006).
- [ ] El panel responde en el dominio auto-generado de Coolify (`*.sslip.io`), servido por HTTPS vía Traefik.

## Avance

**Hecho en código** (local, todavía no deployado):
- App Next.js scaffolded (TypeScript, Tailwind, App Router), stack: Supabase Auth (`@supabase/ssr`) solo para login/sesión + Prisma 7 (`@prisma/adapter-pg`) para datos, mismo patrón que `sistemas`.
- `lib/auth/decide-redirect.ts`: función pura que decide allow/redirect/401, con 9 tests (`npm run test`, todos verdes) — cubre las 3 rutas × sesión-o-no × pertenece-a-esta-app-o-no.
- `proxy.ts` (middleware): arma la sesión de Supabase y delega en `decide-redirect`, incluyendo el chequeo de `app_metadata.app` (ADR-0006).
- `app/login/page.tsx` y `app/page.tsx` (dashboard placeholder).
- `lib/db/prisma.ts` + `prisma/schema.prisma` (sin modelos todavía, eso es del ticket 02).
- `.github/workflows/deploy.yml`: mismo patrón que `tropero`/`saume-next` (SSH + curl a la API de Coolify en cada push a `main`) — el YAML ya está escrito, solo le faltan los Secrets reales de GitHub para poder correr.
- `.env.example`, `README.md` con instrucciones de setup.
- Verificado: `npx tsc --noEmit`, `npm run lint`, `npm run build` y `npm run test` pasan limpio, sin credenciales reales configuradas (el cliente de Prisma es lazy a propósito para no romper el build).
- Pasó por `/code-review` (Standards + Spec): 3 hallazgos de Standards, todos judgement calls menores (nada bloqueante); 3 de Spec, de los cuales 2 ya se corrigieron acá (el workflow de deploy y los 2 casos de test que faltaban) y 1 se descartó como falso positivo (la falta de `url` en `datasource db` de `schema.prisma` es intencional en Prisma 7 con driver adapters, no un olvido).

**Pendiente, son pasos manuales de infra** (no se tocó nada de esto — el VPS es compartido con proyectos de producción y no hay backups configurados, ver `docs/agents/`):
- Crear el repo en GitHub (privado, cuenta `BGilRoces`) y pushear.
- Crear el proyecto `enredado` en Coolify, conectarlo al repo, configurar el dominio auto-generado.
- Cargar los GitHub Secrets que el workflow ya espera (`VPS_DEPLOY_KEY`, `VPS_SSH_HOST`, `VPS_SSH_USER`, `COOLIFY_API_TOKEN`, `COOLIFY_BASE_URL`, `COOLIFY_UUID`).
- Crear el schema `enredado` en la Postgres de `shared-infra`.
- Crear el usuario de Supabase Auth para Bautista con `app_metadata.app = "enredado"`, y cargar `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`/`DATABASE_URL` reales en Coolify.

Buen candidato para correr `/wizard` y hacer estos pasos juntos.
