-- CreateEnum
CREATE TYPE "EstadoIdea" AS ENUM ('idea', 'guionada', 'grabada', 'enDrive');

-- DropIndex
DROP INDEX "PublicacionArchivo_publicacionId_idx";

-- CreateTable
CREATE TABLE "Idea" (
    "id" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "guion" TEXT,
    "linkReferencia1" TEXT,
    "linkReferencia2" TEXT,
    "tipo" "TipoPublicacion" NOT NULL,
    "caption" TEXT,
    "estado" "EstadoIdea" NOT NULL DEFAULT 'idea',
    "driveLink" TEXT,
    "driveFileId" TEXT,
    "driveResourceKey" TEXT,
    "programadaPara" TIMESTAMP(3),
    "publicacionId" TEXT,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Idea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriveCredencial" (
    "id" TEXT NOT NULL,
    "slot" TEXT NOT NULL DEFAULT 'default',
    "cuentaGoogleEmail" TEXT NOT NULL,
    "refreshTokenEncriptado" TEXT NOT NULL,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriveCredencial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Idea_publicacionId_key" ON "Idea"("publicacionId");

-- CreateIndex
CREATE UNIQUE INDEX "DriveCredencial_slot_key" ON "DriveCredencial"("slot");

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_publicacionId_fkey" FOREIGN KEY ("publicacionId") REFERENCES "Publicacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
