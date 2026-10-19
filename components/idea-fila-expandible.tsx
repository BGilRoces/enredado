"use client";

import { useEffect, useState, useTransition } from "react";
import type { Cuenta, EstadoPublicacion, Idea, Producto } from "@prisma/client";
import { claseBadgeEstadoIdea, etiquetaEstadoIdea } from "./etiqueta-estado-idea";
import { esAtrasada } from "@/lib/ideas/es-atrasada";
import { mensajeDeError } from "@/lib/mensaje-de-error";
import {
  calendarizarIdea,
  cambiarEstadoIdea,
  descalendarizarIdea,
  eliminarIdea,
  marcarEnDrive,
  marcarPublicada,
} from "@/app/ideas/actions";
import { aInputDatetimeLocal, claveDiaLocal, desdeHoraLocal, horaLocal } from "@/lib/zona-horaria";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

type IdeaConRelaciones = Idea & {
  cuenta: Cuenta;
  colaboradoras: Cuenta[];
  producto: Producto | null;
  publicaciones: { estado: EstadoPublicacion; programadaPara: Date | null }[];
};

/**
 * Fila colapsable del notebook: título + badge + Cuenta; expandida muestra descripción/guión/links.
 * `mostrarCuentas` en false oculta los badges de Cuenta (si el usuario tiene una sola, sobran).
 */
export function IdeaFilaExpandible({
  idea,
  ahora,
  mostrarCuentas = true,
}: {
  idea: IdeaConRelaciones;
  ahora: Date;
  mostrarCuentas?: boolean;
}) {
  const [abierta, setAbierta] = useState(false);
  const [editandoFecha, setEditandoFecha] = useState(false);
  const [fechaElegida, setFechaElegida] = useState("");
  const [driveLink, setDriveLink] = useState(idea.driveLink ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const [eliminando, startTransition] = useTransition();
  const [guardandoLink, startGuardarLink] = useTransition();
  const atrasada = esAtrasada(ahora, { ...idea, yaPromocionada: idea.publicaciones.some((p) => p.estado === "publicada") });

  function guardarFecha(valor: string) {
    setError(null);
    startTransition(async () => {
      try {
        if (valor) await calendarizarIdea(idea.id, desdeHoraLocal(valor));
        else await descalendarizarIdea(idea.id);
        setEditandoFecha(false);
      } catch (err) {
        setError(mensajeDeError(err));
      }
    });
  }

  function alternarPublicada() {
    setError(null);
    startTransition(async () => {
      try {
        await marcarPublicada(idea.id, !idea.publicadaEl);
      } catch (err) {
        setError(mensajeDeError(err));
      }
    });
  }

  // Alterna Editado ↔ Grabada. No aplica una vez que la idea está en Drive o publicada.
  const puedeMarcarseEditada = !idea.publicadaEl && idea.estado !== "enDrive";
  function alternarEditada() {
    setError(null);
    startTransition(async () => {
      try {
        await cambiarEstadoIdea(idea.id, idea.estado === "editada" ? "grabada" : "editada");
      } catch (err) {
        setError(mensajeDeError(err));
      }
    });
  }

  // Se guarda solo, un rato después de dejar de escribir (o al pegar): pasa la
  // idea a "En Drive" y, si el link es de una carpeta, carga sus archivos (ver marcarEnDrive).
  const driveLinkCambio = driveLink.trim() !== (idea.driveLink ?? "");
  useEffect(() => {
    if (!driveLinkCambio || !driveLink.trim()) return;
    const temporizador = setTimeout(() => {
      setError(null);
      startGuardarLink(async () => {
        try {
          await marcarEnDrive(idea.id, driveLink);
        } catch (err) {
          setError(mensajeDeError(err));
        }
      });
    }, 800);
    return () => clearTimeout(temporizador);
  }, [driveLink, driveLinkCambio, idea.id]);

  function eliminar() {
    setConfirmandoEliminar(false);
    setError(null);
    startTransition(async () => {
      try {
        await eliminarIdea(idea.id);
      } catch (err) {
        setError(mensajeDeError(err));
      }
    });
  }

  const partesFecha = idea.programadaPara ? claveDiaLocal(idea.programadaPara).split("-") : null;

  return (
    <li className="flex overflow-hidden rounded-2xl border border-zinc-200 bg-white text-sm shadow-sm">
      {/* Bloque de fecha aparte, para poder recorrer la lista por día de un vistazo. */}
      <button
        type="button"
        onClick={() => {
          setFechaElegida(aInputDatetimeLocal(idea.programadaPara));
          setEditandoFecha((valor) => !valor);
        }}
        title="Cambiar la fecha"
        aria-label="Cambiar la fecha"
        aria-expanded={editandoFecha}
        className={`flex w-14 shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 border-r border-zinc-200 px-1 py-3 sm:w-20 sm:px-2 text-center transition-colors ${
          atrasada ? "bg-rose-50 hover:bg-rose-100" : "bg-zinc-50 hover:bg-zinc-100"
        } ${editandoFecha ? "ring-2 ring-inset ring-indigo-300" : ""}`}
      >
        {idea.programadaPara && partesFecha ? (
          <>
            <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              {MESES[Number(partesFecha[1]) - 1]}
            </span>
            <span className="text-2xl font-semibold leading-none text-zinc-900">{Number(partesFecha[2])}</span>
            <span className="text-xs text-zinc-500">{horaLocal(idea.programadaPara)}</span>
          </>
        ) : (
          <span className="text-xs font-medium text-zinc-400">Sin fecha</span>
        )}
      </button>
      <div className="flex min-w-0 flex-1 flex-col p-2.5 sm:p-4">
        {editandoFecha && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 p-2">
            <input
              type="datetime-local"
              value={fechaElegida}
              onChange={(evento) => setFechaElegida(evento.target.value)}
              onClick={(evento) => evento.currentTarget.showPicker?.()}
              autoFocus
              className="w-full rounded-lg border border-zinc-300 bg-white p-1.5 text-xs outline-none sm:w-auto focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <button
              type="button"
              disabled={eliminando || !fechaElegida}
              onClick={() => guardarFecha(fechaElegida)}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-50"
            >
              {eliminando ? "Guardando…" : "Guardar fecha"}
            </button>
            {idea.programadaPara && (
              <button
                type="button"
                disabled={eliminando}
                onClick={() => guardarFecha("")}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-50"
              >
                Quitar fecha
              </button>
            )}
            <button
              type="button"
              onClick={() => setEditandoFecha(false)}
              className="px-2 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-700"
            >
              Cancelar
            </button>
          </div>
        )}
        {editandoFecha && error && <p className="mb-3 text-xs text-rose-700">{error}</p>}
        <button
          type="button"
          onClick={() => setAbierta((valor) => !valor)}
          className="flex w-full flex-col gap-2 text-left"
          aria-expanded={abierta}
        >
          <span className="break-words font-medium text-zinc-900">{idea.titulo}</span>
          <span className="flex flex-wrap items-center gap-1.5">
            {mostrarCuentas && [idea.cuenta, ...idea.colaboradoras].map((cuenta) => (
              <span key={cuenta.id} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                {cuenta.nombre}
              </span>
            ))}
            {idea.producto && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">{idea.producto.nombre}</span>
            )}
            <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-xs capitalize text-zinc-600">
              {idea.tipo}
            </span>
            {atrasada && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">Atrasada</span>
            )}
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${claseBadgeEstadoIdea(idea)}`}>
              {etiquetaEstadoIdea(idea)}
            </span>
          </span>
        </button>
        {abierta && (
          <div className="mt-3 flex flex-col gap-2 text-sm text-zinc-700">
            {idea.audio && <p className="text-xs text-zinc-600">Audio: {idea.audio}</p>}
            {idea.descripcion && <p>{idea.descripcion}</p>}
            {idea.guion && (
              <p className="whitespace-pre-wrap rounded-lg bg-zinc-50 p-2 text-xs text-zinc-600">{idea.guion}</p>
            )}
            {(idea.linkReferencia1 || idea.linkReferencia2) && (
              <div className="flex flex-col gap-1">
                {[idea.linkReferencia1, idea.linkReferencia2].filter(Boolean).map((link) => (
                  <a
                    key={link}
                    href={link!}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-xs text-indigo-600 hover:text-indigo-700"
                  >
                    {link}
                  </a>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-2 border-t border-zinc-100 pt-3">
              <div className="relative">
                <input
                  type="url"
                  value={driveLink}
                  onChange={(evento) => setDriveLink(evento.target.value)}
                  placeholder="Link drive"
                  aria-label="Link de Drive"
                  className="w-full rounded-lg border border-zinc-300 px-2 py-1 pr-20 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                {(guardandoLink || (!driveLinkCambio && idea.driveLink)) && (
                  <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[11px] text-zinc-400">
                    {guardandoLink ? "Guardando…" : "Guardado"}
                  </span>
                )}
              </div>
              {confirmandoEliminar ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-rose-50 px-2 py-1.5">
                  <span className="mr-auto text-xs font-medium text-rose-800">¿Eliminar esta idea? No se puede deshacer.</span>
                  <button
                    type="button"
                    onClick={() => setConfirmandoEliminar(false)}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={eliminar}
                    autoFocus
                    className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-rose-700"
                  >
                    Eliminar
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <a
                    href={`/ideas/${idea.id}`}
                    className="rounded-lg bg-zinc-900 shrink-0 whitespace-nowrap px-2 py-1.5 text-xs sm:px-3 font-medium text-white shadow-sm transition-colors hover:bg-zinc-800"
                  >
                    Editar
                  </a>
                  {puedeMarcarseEditada && (
                    <button
                      type="button"
                      onClick={alternarEditada}
                      disabled={eliminando}
                      className={
                        idea.estado === "editada"
                          ? "rounded-lg border border-fuchsia-300 bg-fuchsia-50 shrink-0 whitespace-nowrap px-2 py-1.5 text-xs sm:px-3 font-medium text-fuchsia-700 shadow-sm transition-colors hover:bg-fuchsia-100 disabled:opacity-50"
                          : "rounded-lg bg-fuchsia-600 shrink-0 whitespace-nowrap px-2 py-1.5 text-xs sm:px-3 font-medium text-white shadow-sm transition-colors hover:bg-fuchsia-700 disabled:opacity-50"
                      }
                    >
                      {idea.estado === "editada" ? "Editado ✓" : "Editado"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={alternarPublicada}
                    disabled={eliminando}
                    className={
                      idea.publicadaEl
                        ? "rounded-lg border border-zinc-300 bg-white shrink-0 whitespace-nowrap px-2 py-1.5 text-xs sm:px-3 font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-50"
                        : "rounded-lg bg-emerald-600 shrink-0 whitespace-nowrap px-2 py-1.5 text-xs sm:px-3 font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
                    }
                  >
                    {idea.publicadaEl ? "Publicado ✓" : "Publicado"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmandoEliminar(true)}
                    disabled={eliminando}
                    title="Eliminar idea"
                    aria-label="Eliminar idea"
                    className="ml-auto shrink-0 rounded-lg p-1 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  >
                    {eliminando ? <span className="text-xs">Eliminando…</span> : <IconTacho className="h-4 w-4" />}
                  </button>
                </div>
              )}
            </div>
            {error && <p className="text-xs text-rose-700">{error}</p>}
          </div>
        )}
      </div>
    </li>
  );
}

function IconTacho({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M10 4h4" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}
