"use client";

import { useState, useTransition } from "react";
import type { TipoPublicacion } from "@prisma/client";
import type { DiaDeGrilla } from "@/lib/calendario/mes-en-grilla";
import { claseBadgeEstadoIdea, etiquetaEstadoIdea } from "./etiqueta-estado-idea";
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

export interface ArrastreIdea {
  id: string;
  titulo: string;
}

/** Color sólido para el punto de una Idea en la grilla de celu: el del texto del badge (o su fondo, si el texto es blanco). */
function clasePunto(idea: IdeaEnCalendario): string {
  const clases = claseBadgeEstadoIdea(idea).split(" ");
  const texto = clases.find((c) => c.startsWith("text-") && c !== "text-white");
  return texto ? `bg-current ${texto}` : (clases.find((c) => c.startsWith("bg-")) ?? "bg-zinc-400");
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
  ideaParaProgramar = null,
  alProgramar,
}: {
  dias: DiaDeGrilla[];
  ideasPorDia: Record<string, IdeaEnCalendario[]>;
  hoyClave: string;
  /** Idea sin fecha elegida con un toque (alternativa a arrastrar, para celu): tocar un día la programa ahí. */
  ideaParaProgramar?: ArrastreIdea | null;
  alProgramar?: () => void;
}) {
  const [sobreClave, setSobreClave] = useState<string | null>(null);
  // En celu la grilla sólo muestra puntos: el día tocado lista sus ideas debajo.
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(
    dias.some((dia) => claveDia(dia.fecha) === hoyClave) ? hoyClave : null,
  );
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
        setDiaSeleccionado(modal.clave);
        alProgramar?.();
      } catch (err) {
        setError(mensajeDeError(err));
      }
    });
  }

  const ideasDiaSeleccionado = diaSeleccionado ? (ideasPorDia[diaSeleccionado] ?? []) : [];

  return (
    <div className="flex flex-col gap-4">
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-500">
        {DIAS_SEMANA.map((dia) => (
          <div key={dia} className="px-0.5 py-2 text-center md:p-2">
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
              role="button"
              tabIndex={0}
              aria-label={`${formatearClave(clave)}: ${ideasDelDia.length} idea${ideasDelDia.length === 1 ? "" : "s"}`}
              onClick={(e) => {
                // Los links de cada idea (desktop) navegan solos; el resto de la celda elige el día.
                if ((e.target as HTMLElement).closest("a")) return;
                if (ideaParaProgramar) abrirModal(clave, ideaParaProgramar);
                else setDiaSeleccionado(clave);
              }}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
                e.preventDefault();
                if (ideaParaProgramar) abrirModal(clave, ideaParaProgramar);
                else setDiaSeleccionado(clave);
              }}
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
              className={`flex min-h-14 cursor-pointer flex-col items-center gap-1 border-b border-r border-zinc-100 p-1 last:border-r-0 md:min-h-24 md:items-stretch md:p-1.5 ${
                dia.delMesActual ? "bg-white" : "bg-zinc-50"
              } ${sobreClave === clave ? "ring-2 ring-inset ring-indigo-400" : ""} ${
                ideaParaProgramar ? "hover:bg-indigo-50" : ""
              } ${diaSeleccionado === clave && !ideaParaProgramar ? "max-md:bg-indigo-50" : ""}`}
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
              {ideasDelDia.length > 0 && (
                <span className="flex flex-wrap justify-center gap-0.5 md:hidden" aria-hidden="true">
                  {ideasDelDia.slice(0, 4).map((idea) => (
                    <span key={idea.id} className={`h-1.5 w-1.5 rounded-full ${clasePunto(idea)}`} />
                  ))}
                </span>
              )}
              <div className="hidden max-h-20 flex-col gap-0.5 overflow-y-auto md:flex">
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
    </div>

      {diaSeleccionado && (
        <section className="flex flex-col gap-2 md:hidden" aria-live="polite">
          <h2 className="text-sm font-semibold text-zinc-900">{formatearClave(diaSeleccionado)}</h2>
          {ideasDiaSeleccionado.length === 0 ? (
            <p className="text-sm text-zinc-500">Nada programado este día.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {[...ideasDiaSeleccionado]
                .sort((a, b) => (a.programadaPara?.getTime() ?? 0) - (b.programadaPara?.getTime() ?? 0))
                .map((idea) => (
                  <li key={idea.id}>
                    <a
                      href={`/ideas/${idea.id}`}
                      className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-3 text-sm shadow-sm"
                    >
                      <span className="w-11 shrink-0 pt-0.5 text-xs font-medium text-zinc-500">
                        {idea.programadaPara ? horaLocal(idea.programadaPara) : ""}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="break-words font-medium text-zinc-900">{idea.titulo}</span>
                        <span className="text-xs text-zinc-500">
                          {idea.cuentaNombre}
                          {idea.productoNombre ? ` · ${idea.productoNombre}` : ""} · {idea.tipo}
                        </span>
                        <span className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-medium ${claseBadgeEstadoIdea(idea)}`}>
                          {etiquetaEstadoIdea(idea)}
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
            </ul>
          )}
        </section>
      )}

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
