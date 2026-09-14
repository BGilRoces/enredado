-- CreateEnum
CREATE TYPE "TipoPublicacion" AS ENUM ('post', 'historia', 'reel');

-- CreateEnum
CREATE TYPE "EstadoPublicacion" AS ENUM ('publicando', 'publicada', 'fallida');

-- CreateTable
CREATE TABLE "Publicacion" (
    "id" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "tipo" "TipoPublicacion" NOT NULL,
    "driveFileId" TEXT NOT NULL,
    "caption" TEXT,
    "estado" "EstadoPublicacion" NOT NULL DEFAULT 'publicando',
    "metaMediaId" TEXT,
    "error" TEXT,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Publicacion_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Publicacion" ADD CONSTRAINT "Publicacion_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
