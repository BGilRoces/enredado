# enredado

Panel propio (Next.js) para gestionar varias Cuentas de Instagram: elegir imágenes/videos desde Google Drive y publicarlos como Post, Historia o Reel — de inmediato o programado — usando la API oficial de Meta.

Ver [`CONTEXT.md`](./CONTEXT.md) para el glosario del proyecto y [`docs/adr/`](./docs/adr/) para las decisiones de arquitectura. El spec completo y los tickets viven en [`.scratch/panel-instagram-v1/`](./.scratch/panel-instagram-v1/).

## Stack

- **Next.js** (App Router, TypeScript, Tailwind).
- **Supabase Auth** (`@supabase/ssr`) para el login — usa la instancia compartida `shared-infra` del VPS, no una propia (ver ADR-0002/0003).
- **Prisma 7** (`@prisma/adapter-pg`) para los datos del dominio — misma Postgres de `shared-infra`, en su propio schema `enredado`.
- **Vitest** para tests. Sin prior art de testing en el resto de los proyectos del VPS; se eligió por ser el default liviano actual para proyectos TS/Next.

Este stack sigue el mismo patrón que `saume-sistema` (el panel interno más parecido a este: Supabase Auth solo para sesión/login, Prisma para los datos, nunca `.from()` de supabase-js para queries de dominio).

## Convención de auth entre apps (importante)

El proyecto de Supabase Auth de `shared-infra` es **compartido** entre `tropero`, `sistemas` y `bertha`. Un login válido ahí no implica que el usuario pertenezca a este panel: cualquier credencial válida en esa instancia podría, en teoría, loguearse en cualquier app que apunte a la misma instancia.

Por eso cada usuario de este panel necesita `app_metadata.app = "enredado"` seteado a mano en Supabase Studio al crearlo (mismo mecanismo que `sistemas` usa con `app_metadata.empresa`). El middleware (`proxy.ts`) rechaza cualquier sesión que no tenga ese claim — ver `lib/auth/decide-redirect.ts` (testeado) y `lib/app-config.ts`.

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # completar con los valores reales (Coolify → shared-infra)
npx prisma generate
npm run dev
```

Variables de entorno: ver [`.env.example`](./.env.example). Nunca commitear `.env.local` ni pegar los valores reales en ningún chat o archivo del repo.

## Comandos

```bash
npm run dev        # servidor de desarrollo
npm run build      # build de producción
npm run lint       # eslint
npm run test       # vitest, una corrida
npm run test:watch # vitest en watch
npx tsc --noEmit   # typecheck
```

## Deploy

Igual que el resto de los proyectos del VPS: push a `main` dispara un GitHub Action que hace SSH al VPS y llama a la API de Coolify para redeployar el proyecto `enredado` (ver ADR-0003 y `docs/agents/issue-tracker.md` para cómo se trackea el trabajo pendiente).

**Nota:** crear el proyecto en Coolify, generar el `COOLIFY_API_TOKEN`, cargar los GitHub Secrets, y crear el schema `enredado` en la Postgres de `shared-infra` son pasos manuales — ninguno se hizo todavía como parte del ticket 01 en código, quedan pendientes de correr con vos (candidatos a `/wizard`).
