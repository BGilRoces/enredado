"use client";

import { useState, useTransition } from "react";
import { mensajeDeError } from "@/lib/mensaje-de-error";

/** Botón "×" para descartar una fila de "Necesita atención" (ver app/actions.ts). */
export function DescartarAlertaBoton({ onDescartar }: { onDescartar: () => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  const [descartando, startTransition] = useTransition();

  function descartar() {
    setError(null);
    startTransition(async () => {
      try {
        await onDescartar();
      } catch (err) {
        setError(mensajeDeError(err));
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={descartar}
        disabled={descartando}
        title="Descartar"
        aria-label="Descartar alerta"
        className="shrink-0 rounded-full p-1 text-rose-400 transition-colors hover:bg-rose-100 hover:text-rose-700 disabled:opacity-50"
      >
        ×
      </button>
      {error && <p className="max-w-[12rem] text-right text-xs text-rose-700">{error}</p>}
    </div>
  );
}
