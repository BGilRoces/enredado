"use client";

import { useState, useTransition } from "react";
import type { TipoPublicacion } from "@prisma/client";
import type { DiaDeGrilla } from "@/lib/calendario/mes-en-grilla";
import { claseBadgeEstadoIdea } from "./etiqueta-estado-idea";
import type { IdeaConEstado } from "./etiqueta-estado-idea";
import { calendarizarIdea } from "@/app/ideas/actions";
import { mensajeDeError } from "@/lib/mensaje-de-error";
import { desdeHoraLocal, horaLocal } from "@/lib/zona-horaria";

export interface IdeaEnCalendario extends IdeaConEstado {
  id: string;
  titulo: string;
  cuentaNombre: string;
  /** Null = idea general (de marca). */
  productoNombre: string | null;
  tipo: TipoPublicacion;
}

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function claveDia(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function formatearClave(clave: string): string {
  const [anio, mes, dia] = clave.split("-");
  return `${dia}/${mes}/${anio}`;
}

interface ArrastreIdea {
  id: string;
  titulo: string;
}

/** Payload que viaja en el dataTransfer al arrastrar una idea desde la lista de pendientes (ver IdeasPendientesLista). */
function leerArrastre(e: React.DragEvent): ArrastreIdea | null {
  const raw = e.dataTransfer.getData("text/plain");
  if (!raw) return null;
  try {
    const datos = JSON.parse(raw);
    if (typeof datos?.id === "string" && typeof datos?.titulo === "string") return datos;
    return null;
  } catch {
    return null;
  }
}

/**
 * Grilla mensual sin librería (no existe ninguna en el proyecto). Client
 * component: además de mostrar las Ideas ya calendarizadas, acepta soltar acá
 * una Idea arrastrada desde la lista de pendientes (ver IdeasPendientesLista)
 * y pide hora antes de confirmar — calendarizarIdea ya soporta setear
 * programadaPara sin pasar por /ideas/[id].
 */
export function CalendarioMes({
  dias,
  ideasPorDia,
  hoyClave,
}: {
  dias: DiaDeGrilla[];
  ideasPorDia: Record<string, IdeaEnCalendario[]>;
  hoyClave: string;
}) {
  const [sobreClave, setSobreClave] = useState<string | null>(null);
  const [modal, setModal] = useState<{ clave: string; idea: ArrastreIdea } | null>(null);
  const [hora, setHora] = useState("12:00");
  const [error, setError] = useState<string | null>(null);
  const [guardando, startTransition] = useTransition();

  function abrirModal(clave: string, idea: ArrastreIdea) {
    setModal({ clave, idea });
    setHora("12:00");
    setError(null);
  }

  function confirmar() {
    if (!modal) return;
    setError(null);
    startTransition(async () => {
      try {
        await calendarizarIdea(modal.idea.id, desdeHoraLocal(`${modal.clave}T${hora}`));
        setModal(null);
      } catch (err) {
        setError(mensajeDeError(err));
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-500">
        {DIAS_SEMANA.map((dia) => (
          <div key={dia} className="p-2 text-center">
            {dia}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dias.map((dia) => {
          const clave = claveDia(dia.fecha);
          const ideasDelDia = ideasPorDia[clave] ?? [];
          return (
            <div
              key={clave}
              onDragOver={(e) => {
                e.preventDefault();
                setSobreClave(clave);
              }}
              onDragLeave={() => setSobreClave((actual) => (actual === clave ? null : actual))}
              onDrop={(e) => {
                e.preventDefault();
                setSobreClave(null);
                const idea = leerArrastre(e);
                if (idea) abrirModal(clave, idea);
              }}
              className={`flex min-h-24 flex-col gap-1 border-b border-r border-zinc-100 p-1.5 last:border-r-0 ${
                dia.delMesActual ? "bg-white" : "bg-zinc-50"
              } ${sobreClave === clave ? "ring-2 ring-inset ring-indigo-400" : ""}`}
            >
              <span
                className={`text-xs ${
                  clave === hoyClave
                    ? "flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 font-medium text-white"
                    : dia.delMesActual
                      ? "text-zinc-700"
                      : "text-zinc-300"
                }`}
              >
                {dia.fecha.getUTCDate()}
              </span>
              <div className="flex max-h-20 flex-col gap-0.5 overflow-y-auto">
                {ideasDelDia.map((idea) => (
                  <a
                    key={idea.id}
                    href={`/ideas/${idea.id}`}
                    className={`truncate rounded px-1 py-0.5 text-[11px] leading-tight ${claseBadgeEstadoIdea(idea)}`}
                    title={`${idea.titulo} · ${idea.cuentaNombre}${idea.productoNombre ? ` · ${idea.productoNombre}` : ""}`}
                  >
                    {idea.programadaPara && (
                      <span className="mr-1 font-medium">{horaLocal(idea.programadaPara)}</span>
                    )}
                    {idea.titulo}
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-4 shadow-lg">
            <p className="text-sm font-medium text-zinc-900">Programar &quot;{modal.idea.titulo}&quot;</p>
            <p className="mt-1 text-xs text-zinc-500">Para el {formatearClave(modal.clave)}, a las:</p>
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="mt-2 w-full rounded-lg border border-zinc-300 p-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            {error && <p className="mt-2 text-xs text-rose-700">{error}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                disabled={guardando}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmar}
                disabled={guardando}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
              >
                {guardando ? "Guardando…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
