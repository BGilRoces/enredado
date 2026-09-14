-- CreateEnum
CREATE TYPE "TipoMedia" AS ENUM ('imagen', 'video');

-- AlterEnum
ALTER TYPE "EstadoPublicacion" ADD VALUE 'pendiente';
ALTER TYPE "EstadoPublicacion" ADD VALUE 'cancelada';

-- AlterTable
ALTER TABLE "Publicacion" ADD COLUMN     "programadaPara" TIMESTAMP(3),
ADD COLUMN     "storageUrl" TEXT,
ADD COLUMN     "tipoMedia" "TipoMedia",
ALTER COLUMN "estado" SET DEFAULT 'pendiente';
