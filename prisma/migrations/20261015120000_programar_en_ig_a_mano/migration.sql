-- El panel deja de publicar en Instagram (ver ADR-0020): la programación se
-- hace a mano en la app de IG, donde sí se puede elegir un audio de la
-- biblioteca. La Idea sólo recuerda si ya la programaron ahí y con qué audio.
ALTER TABLE "Idea" ADD COLUMN "programadaEnIgEl" TIMESTAMP(3);
ALTER TABLE "Idea" ADD COLUMN "audio" TEXT;

-- Nada va a procesar la cola: lo que quedó pendiente en el panel no va a
-- salir solo. Se cancela para no dejar filas "programadas" engañosas; las
-- Ideas vinculadas pasan a verse como "falta programar en IG".
UPDATE "Publicacion" SET "estado" = 'cancelada' WHERE "estado" IN ('pendiente', 'bloqueadaPorLimite');
