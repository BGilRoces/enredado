# enredado

Panel propio (Next.js) para gestionar varios Instagrams: elegir fotos desde Google Drive y subirlas como post o historia a la cuenta que corresponda, con colaboradores con acceso acotado por cuenta más adelante. Se aloja en un VPS propio compartido con otros proyectos, así que la prioridad es bajo consumo de recursos, no escala.

## Agent skills

Instaladas desde [mattpocock/skills](https://github.com/mattpocock/skills) en `.claude/skills/`.

### Issue tracker

Markdown local en `.scratch/`. Ver `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` en la raíz. Ver `docs/agents/domain.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
