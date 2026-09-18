/*
  Warnings:

  - You are about to drop the column `publicacionId` on the `Idea` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Idea" DROP CONSTRAINT "Idea_publicacionId_fkey";

-- DropIndex
DROP INDEX "Idea_publicacionId_key";

-- AlterTable
ALTER TABLE "Idea" DROP COLUMN "publicacionId";

-- AlterTable
ALTER TABLE "Publicacion" ADD COLUMN     "driveResourceKey" TEXT,
ADD COLUMN     "ideaId" TEXT;

-- AlterTable
ALTER TABLE "PublicacionArchivo" ADD COLUMN     "driveResourceKey" TEXT,
ALTER COLUMN "tipoMedia" DROP NOT NULL,
ALTER COLUMN "storageUrl" DROP NOT NULL;

-- CreateTable
CREATE TABLE "IdeaArchivo" (
    "id" TEXT NOT NULL,
    "ideaId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "driveFileId" TEXT NOT NULL,
    "driveResourceKey" TEXT,
    "nombre" TEXT,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdeaArchivo_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Publicacion" ADD CONSTRAINT "Publicacion_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaArchivo" ADD CONSTRAINT "IdeaArchivo_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
