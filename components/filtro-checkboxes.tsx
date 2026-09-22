"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

interface Opcion {
  value: string;
  label: string;
}

/**
 * Dropdown de checkboxes que filtra al tildar/destildar, sin botón
 * "Filtrar". `seleccionadas === null` significa "todas" (sin filtro en la
 * URL, el estado por default). Reusa la query string actual leyéndola del
 * DOM en vez de useSearchParams para no requerir un boundary de Suspense.
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
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  const activas = seleccionadas ?? opciones.map((opcion) => opcion.value);
  const todasSeleccionadas = activas.length === opciones.length;

  useEffect(() => {
    if (!abierto) return;
    function alClickearFuera(evento: MouseEvent) {
      if (!contenedorRef.current?.contains(evento.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", alClickearFuera);
    return () => document.removeEventListener("mousedown", alClickearFuera);
  }, [abierto]);

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

  const resumen = todasSeleccionadas
    ? "Todas"
    : activas.length === 0
      ? "Ninguna"
      : activas.length === 1
        ? (opciones.find((o) => o.value === activas[0])?.label ?? "1 seleccionada")
        : `${activas.length} seleccionadas`;

  return (
    <div ref={contenedorRef} className="relative inline-block text-sm">
      <button
        type="button"
        onClick={() => setAbierto((valor) => !valor)}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
      >
        <span className="text-xs font-medium text-zinc-500">{etiqueta}</span>
        <span className="font-medium">{resumen}</span>
        <span className="text-zinc-400">▾</span>
      </button>

      {abierto && (
        <div className="absolute left-0 top-full z-10 mt-1 flex w-max min-w-[180px] flex-col gap-1 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg">
          <button
            type="button"
            onClick={alternarTodas}
            className="rounded-md px-2 py-1.5 text-left text-xs font-medium text-indigo-600 transition-colors hover:bg-zinc-50"
          >
            {todasSeleccionadas ? "Deseleccionar todas" : "Seleccionar todas"}
          </button>
          <div className="my-1 border-t border-zinc-100" />
          {opciones.map((opcion) => (
            <label
              key={opcion.value}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
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
      )}
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
