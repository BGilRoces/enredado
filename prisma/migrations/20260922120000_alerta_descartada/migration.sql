-- AlterTable
ALTER TABLE "Cuenta" ADD COLUMN     "alertaDescartada" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Publicacion" ADD COLUMN     "alertaDescartada" BOOLEAN NOT NULL DEFAULT false;
