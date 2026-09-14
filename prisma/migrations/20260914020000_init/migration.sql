-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EstadoCuenta" AS ENUM ('conectada', 'desconectada');

-- CreateTable
CREATE TABLE "Cuenta" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "igUserId" TEXT NOT NULL,
    "igUsername" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "accessTokenEncriptado" TEXT,
    "tokenExpiraEl" TIMESTAMP(3),
    "estado" "EstadoCuenta" NOT NULL DEFAULT 'conectada',
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cuenta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cuenta_igUserId_key" ON "Cuenta"("igUserId");
