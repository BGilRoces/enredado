"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

/** Minúsculas y sin tildes, para que "camara" encuentre "Cámara". */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

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
  const [busqueda, setBusqueda] = useState("");
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

  // En celu el foco automático en la búsqueda abre el teclado y tapa la hoja de opciones.
  const buscadorRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (abierto && window.matchMedia("(min-width: 768px)").matches) buscadorRef.current?.focus();
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

  const opcionesVisibles = busqueda.trim()
    ? opciones.filter((opcion) => normalizar(opcion.label).includes(normalizar(busqueda)))
    : opciones;

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
        onClick={() => {
          setBusqueda("");
          setAbierto((valor) => !valor);
        }}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
      >
        <span className="text-xs font-medium text-zinc-500">{etiqueta}</span>
        <span className="font-medium">{resumen}</span>
        <span className="text-zinc-400">▾</span>
      </button>

      {abierto && (
        <>
        {/* En celu el menú es una hoja que sube desde abajo, con fondo para cerrarla. */}
        <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setAbierto(false)} aria-hidden="true" />
        <div className="fixed inset-x-0 bottom-0 z-50 flex max-h-[75vh] flex-col gap-1 rounded-t-2xl border-t border-zinc-200 bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-lg md:absolute md:inset-x-auto md:bottom-auto md:left-0 md:top-full md:z-10 md:mt-1 md:max-h-none md:w-max md:min-w-[180px] md:rounded-lg md:border md:p-2">
          <div className="flex items-center justify-between px-2 pb-1 md:hidden">
            <span className="text-sm font-semibold text-zinc-900">{etiqueta.replace(/:$/, "")}</span>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="rounded-lg px-2 py-1 text-sm font-medium text-indigo-600"
            >
              Listo
            </button>
          </div>
          <button
            type="button"
            onClick={alternarTodas}
            className="rounded-md px-2 py-1.5 text-left text-xs font-medium text-indigo-600 transition-colors hover:bg-zinc-50"
          >
            {todasSeleccionadas ? "Deseleccionar todas" : "Seleccionar todas"}
          </button>
          <input
            type="search"
            ref={buscadorRef}
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Buscar…"
            className="rounded-md border border-zinc-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          <div className="my-1 border-t border-zinc-100" />
          {opcionesVisibles.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-zinc-500">Sin resultados.</p>
          )}
          <div className="flex min-h-0 flex-col gap-1 overflow-y-auto md:max-h-64">
          {opcionesVisibles.map((opcion) => (
            <label
              key={opcion.value}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 md:py-1.5"
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
        </div>
        </>
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
