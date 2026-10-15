"use client";

import { useState, useTransition } from "react";
import { mensajeDeError } from "@/lib/mensaje-de-error";
import { crearProducto, eliminarProducto, renombrarProducto } from "@/app/cuentas/productos-actions";

interface ProductoFila {
  id: string;
  nombre: string;
}

/** Lista colapsable de los Productos de una Cuenta, con alta, renombrado y baja. */
export function ProductosCuenta({ cuentaId, productos }: { cuentaId: string; productos: ProductoFila[] }) {
  const [abierto, setAbierto] = useState(false);
  const [nuevo, setNuevo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function correr(accion: () => Promise<{ ok: true } | { ok: false; error: string }>, alExito?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        const resultado = await accion();
        if (resultado.ok) alExito?.();
        else setError(resultado.error);
      } catch (err) {
        setError(mensajeDeError(err));
      }
    });
  }

  function renombrar(producto: ProductoFila) {
    const nombre = window.prompt("Nuevo nombre del producto:", producto.nombre);
    if (nombre === null || nombre.trim() === producto.nombre) return;
    correr(() => renombrarProducto(producto.id, nombre));
  }

  function eliminar(producto: ProductoFila) {
    if (!window.confirm(`¿Eliminar "${producto.nombre}"? Sus ideas pasan a "general".`)) return;
    correr(() => eliminarProducto(producto.id));
  }

  return (
    <div className="mt-3 border-t border-zinc-100 pt-3">
      <button
        type="button"
        onClick={() => setAbierto((valor) => !valor)}
        aria-expanded={abierto}
        className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
      >
        Productos ({productos.length}) {abierto ? "▴" : "▾"}
      </button>
      {abierto && (
        <div className="mt-2 flex flex-col gap-2">
          {productos.length === 0 && (
            <p className="text-xs text-zinc-500">Sin productos: todas las ideas de esta Cuenta son de marca.</p>
          )}
          <ul className="flex flex-col gap-1">
            {productos.map((producto) => (
              <li key={producto.id} className="flex items-center justify-between gap-2 text-sm text-zinc-700">
                <span className="min-w-0 truncate">{producto.nombre}</span>
                <span className="flex shrink-0 gap-3 text-xs">
                  <button
                    type="button"
                    disabled={pendiente}
                    onClick={() => renombrar(producto)}
                    className="font-medium text-zinc-500 hover:text-zinc-700 disabled:opacity-50"
                  >
                    Renombrar
                  </button>
                  <button
                    type="button"
                    disabled={pendiente}
                    onClick={() => eliminar(producto)}
                    className="font-medium text-rose-600 hover:text-rose-700 disabled:opacity-50"
                  >
                    Eliminar
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <form
            className="flex gap-2"
            onSubmit={(evento) => {
              evento.preventDefault();
              correr(() => crearProducto(cuentaId, nuevo), () => setNuevo(""));
            }}
          >
            <input
              value={nuevo}
              onChange={(evento) => setNuevo(evento.target.value)}
              placeholder="Nuevo producto"
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 p-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <button
              type="submit"
              disabled={pendiente || !nuevo.trim()}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
            >
              Agregar
            </button>
          </form>
          {error && <p className="text-xs text-rose-700">{error}</p>}
        </div>
      )}
    </div>
  );
}
