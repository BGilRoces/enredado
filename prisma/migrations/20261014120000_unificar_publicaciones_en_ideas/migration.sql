-- Toda Publicación pasa a pertenecer a una Idea (ver ADR-0019): las creadas
-- desde /publicar antes de este cambio no tenían `ideaId`, así que no se veían
-- en Ideas ni en el calendario. Se crea una Idea `enDrive` por cada una
-- todavía ACTIVA (pendiente/publicando, las únicas que hay que poder ver,
-- editar y cancelar) y se las vincula. El historial terminal (publicada,
-- fallida, cancelada, bloqueada) queda sin Idea, en /historial: migrarlo
-- llenaría Ideas y el calendario de ruido. Las Ideas nacen YA vinculadas a su Publicación, así el worker
-- de Ideas nunca las ve como elegibles para promover de nuevo.

INSERT INTO "Idea" ("id", "cuentaId", "titulo", "tipo", "caption", "estado", "driveFileId", "driveResourceKey", "programadaPara", "creadaEn", "actualizadaEn")
SELECT
    'mig_' || p."id",
    p."cuentaId",
    COALESCE(
        NULLIF(left(btrim(split_part(COALESCE(p."caption", ''), E'\n', 1)), 80), ''),
        p."tipo"::text || ' sin título'
    ),
    p."tipo",
    p."caption",
    'enDrive',
    p."driveFileId",
    p."driveResourceKey",
    COALESCE(p."programadaPara", p."creadaEn"),
    p."creadaEn",
    CURRENT_TIMESTAMP
FROM "Publicacion" p
WHERE p."ideaId" IS NULL AND p."estado" IN ('pendiente', 'publicando');

INSERT INTO "IdeaArchivo" ("id", "ideaId", "orden", "driveFileId", "driveResourceKey", "creadaEn")
SELECT
    'mig_' || pa."id",
    'mig_' || pa."publicacionId",
    pa."orden",
    pa."driveFileId",
    pa."driveResourceKey",
    pa."creadaEn"
FROM "PublicacionArchivo" pa
JOIN "Publicacion" p ON p."id" = pa."publicacionId"
WHERE p."ideaId" IS NULL AND p."estado" IN ('pendiente', 'publicando');

UPDATE "Publicacion"
SET "ideaId" = 'mig_' || "id"
WHERE "ideaId" IS NULL AND "estado" IN ('pendiente', 'publicando');
