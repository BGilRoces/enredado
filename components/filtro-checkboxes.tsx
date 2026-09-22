"use client";

import { useRouter, usePathname } from "next/navigation";

interface Opcion {
  value: string;
  label: string;
}

/**
 * Grupo de checkboxes que filtra al tildar/destildar, sin botón "Filtrar".
 * `seleccionadas === null` significa "todas" (sin filtro en la URL, el
 * estado por default). Reusa la query string actual leyéndola del DOM en
 * vez de useSearchParams para no requerir un boundary de Suspense.
 */
export function FiltroCheckboxes({
  name,
  etiqueta,
  opciones,
  seleccionadas,
}: {
  name: string;
  etiqueta: string;
  opciones: Opcion[];
  seleccionadas: string[] | null;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const activas = seleccionadas ?? opciones.map((opcion) => opcion.value);
  const todasSeleccionadas = activas.length === opciones.length;

  function navegarCon(nuevaSeleccion: string[]) {
    const params = new URLSearchParams(window.location.search);
    if (nuevaSeleccion.length === opciones.length) {
      params.delete(name);
    } else {
      params.set(name, nuevaSeleccion.join(","));
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function alternarOpcion(value: string) {
    const nuevaSeleccion = activas.includes(value)
      ? activas.filter((v) => v !== value)
      : [...activas, value];
    navegarCon(nuevaSeleccion);
  }

  function alternarTodas() {
    navegarCon(todasSeleccionadas ? [] : opciones.map((opcion) => opcion.value));
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-xs font-medium text-zinc-500">{etiqueta}</span>
      <button
        type="button"
        onClick={alternarTodas}
        className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium text-zinc-600 shadow-sm transition-colors hover:bg-zinc-50"
      >
        {todasSeleccionadas ? "Deseleccionar todas" : "Seleccionar todas"}
      </button>
      {opciones.map((opcion) => (
        <label
          key={opcion.value}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-700 shadow-sm"
        >
          <input
            type="checkbox"
            checked={activas.includes(opcion.value)}
            onChange={() => alternarOpcion(opcion.value)}
            className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
          />
          {opcion.label}
        </label>
      ))}
    </div>
  );
}

/** Parsea el valor crudo de un searchParam multi-valor: `null` = "todas". */
export function parsearSeleccionMultiple<T extends string>(
  valor: string | string[] | undefined,
  valoresValidos: readonly T[],
): T[] | null {
  if (valor === undefined) return null;
  const crudo = Array.isArray(valor) ? valor[0] : valor;
  if (crudo === "") return [];
  const validos = new Set<string>(valoresValidos);
  return crudo.split(",").filter((v): v is T => validos.has(v));
}
