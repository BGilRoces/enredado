# 01: Schema de Idea + DriveCredencial

**What to build:** Modelo `Idea`/`EstadoIdea` y `DriveCredencial` en Prisma, relaciones inversas en `Cuenta`/`Publicacion`, migración aplicada, y las ADRs de las decisiones ya tomadas (0013/0014/0015).

**Blocked by:** ninguno

**Status:** done

- [x] `EstadoIdea` (idea/guionada/grabada/enDrive) y modelo `Idea` en `prisma/schema.prisma`.
- [x] Modelo `DriveCredencial` (singleton por `slot` único).
- [x] `Cuenta.ideas` y `Publicacion.idea` como relaciones inversas aditivas.
- [x] ADR-0013, ADR-0014, ADR-0015 escritas.
- [x] Migración generada y aplicada contra la base real de `shared-infra`.

## Avance

`npx prisma validate`/`generate` limpios. Migración `20260918015404_idea_calendario` generada y aplicada contra la base real (túnel SSH a `vps`, confirmado con Bautista antes de tocarla).

**Efecto colateral no relacionado, detectado al aplicar**: el diff de Prisma incluyó `DROP INDEX "PublicacionArchivo_publicacionId_idx"` — un índice que la migración `20260914070000_publicacion_archivo` había creado pero que `schema.prisma` nunca declaró explícitamente (`@@index`). No es parte de este feature; probablemente un cambio de comportamiento por defecto entre versiones de Prisma. Se dejó pasar: sólo afecta performance de un lookup por FK en una tabla chica (carousels, máximo 10 filas por Publicación), sin riesgo de datos, coherente con la prioridad de "bajo consumo de recursos, no escala" de este panel — pero vale que Bautista lo sepa, no fue una decisión de este ticket.
