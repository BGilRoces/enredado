/**
 * Config de Prisma 7 para el CLI (migrate/generate). El cliente en runtime
 * (lib/db/prisma.ts) sigue usando el driver adapter, no esto — ver el
 * comentario de ahí. En local carga .env.local a mano porque prisma/config
 * no lo hace solo (Next.js lo hace por su cuenta, pero el CLI de Prisma no
 * pasa por Next.js).
 */
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
