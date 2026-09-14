import { defineConfig } from "vitest/config";

export default defineConfig({
  // Mismo alias que tsconfig.json ("@/*" -> "./*") — sin esto, Vitest no
  // resuelve ningún import "@/..." (nadie lo había pisado hasta ahora porque
  // los módulos con tests nunca habían llegado, ni transitivamente, a un
  // archivo que usara ese alias).
  resolve: {
    alias: {
      "@": import.meta.dirname,
    },
  },
  test: {
    environment: "node",
  },
});
