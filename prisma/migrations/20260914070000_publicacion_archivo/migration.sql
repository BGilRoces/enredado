-- AlterTable
ALTER TABLE "Publicacion" ALTER COLUMN "driveFileId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "PublicacionArchivo" (
    "id" TEXT NOT NULL,
    "publicacionId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "driveFileId" TEXT NOT NULL,
    "tipoMedia" "TipoMedia" NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicacionArchivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublicacionArchivo_publicacionId_idx" ON "PublicacionArchivo"("publicacionId");

-- AddForeignKey
ALTER TABLE "PublicacionArchivo" ADD CONSTRAINT "PublicacionArchivo_publicacionId_fkey" FOREIGN KEY ("publicacionId") REFERENCES "Publicacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
