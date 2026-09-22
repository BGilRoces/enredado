"use client";

import { useState, useTransition } from "react";
import { mensajeDeError } from "@/lib/mensaje-de-error";
import { eliminarCuenta } from "@/app/cuentas/actions";

/** Botón para las filas "Desconectada" fantasma (ver ADR de reconexión): borra la fila de verdad, no sólo el token. */
export function EliminarCuentaBoton({ id, nombre }: { id: string; nombre: string }) {
  const [error, setError] = useState<string | null>(null);
  const [eliminando, startTransition] = useTransition();

  function eliminar() {
    if (!window.confirm(`¿Eliminar la Cuenta "${nombre}"? No se puede deshacer.`)) return;
    setError(null);
    startTransition(async () => {
      try {
        const resultado = await eliminarCuenta(id);
        if (!resultado.ok) setError(resultado.error);
      } catch (err) {
        setError(mensajeDeError(err));
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={eliminar}
        disabled={eliminando}
        className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm text-rose-700 transition-colors hover:bg-rose-50 disabled:opacity-50"
      >
        {eliminando ? "Eliminando…" : "Eliminar"}
      </button>
      {error && <p className="max-w-xs text-right text-xs text-rose-700">{error}</p>}
    </div>
  );
}
