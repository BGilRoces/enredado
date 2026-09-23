"use client";

import { useRouter, usePathname } from "next/navigation";

const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/**
 * Selects de mes y año que navegan al cambiar, preservando el resto de la
 * query string actual (leída del DOM, sin useSearchParams, para no requerir
 * un boundary de Suspense).
 */
export function SelectorMes({ anio, mes }: { anio: number; mes: number }) {
  const router = useRouter();
  const pathname = usePathname();

  function navegarA(nuevoAnio: number, nuevoMes: number) {
    const params = new URLSearchParams(window.location.search);
    params.set("mes", `${nuevoAnio}-${String(nuevoMes).padStart(2, "0")}`);
    router.push(`${pathname}?${params.toString()}`);
  }

  const anios = Array.from({ length: 7 }, (_, i) => anio - 3 + i);

  return (
    <div className="flex items-center gap-2">
      <select
        value={mes}
        onChange={(evento) => navegarA(anio, Number(evento.target.value))}
        className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
      >
        {NOMBRES_MES.map((nombre, indice) => (
          <option key={nombre} value={indice + 1}>
            {nombre}
          </option>
        ))}
      </select>
      <select
        value={anio}
        onChange={(evento) => navegarA(Number(evento.target.value), mes)}
        className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
      >
        {anios.map((valor) => (
          <option key={valor} value={valor}>
            {valor}
          </option>
        ))}
      </select>
    </div>
  );
}
