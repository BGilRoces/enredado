/**
 * Singleton de PrismaClient para el servidor, apuntando al schema `enredado`
 * dentro de la Postgres compartida de `shared-infra` (ver ADR-0002 y ADR-0003).
 *
 * El cliente se construye recién en el primer uso real (Proxy), no al
 * importar este módulo: `next build` importa las route handlers para
 * analizarlas sin ejecutar nada, así que si el cliente se construyera de
 * forma eager acá, el build fallaría por falta de `DATABASE_URL` aunque
 * ninguna query se vaya a correr durante el build.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL no está configurado");

  // El schema (`enredado`) viaja en el ?schema= de la connection string; el
  // driver adapter no lo lee solo, hay que pasárselo explícito o las queries
  // caen en el schema `public` por defecto de Postgres.
  const schema =
    new URL(connectionString).searchParams.get("schema") ?? undefined;

  const adapter = new PrismaPg(
    { connectionString },
    schema ? { schema } : undefined
  );
  return new PrismaClient({ adapter });
}

function getPrismaClient() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getPrismaClient(), prop, receiver);
  },
});
