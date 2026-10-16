"use client";

import { useState, useTransition } from "react";
import type { Cuenta, EstadoPublicacion, Idea, Producto } from "@prisma/client";
import { claseBadgeEstadoIdea, etiquetaEstadoIdea } from "./etiqueta-estado-idea";
import { esAtrasada } from "@/lib/ideas/es-atrasada";
import { mensajeDeError } from "@/lib/mensaje-de-error";
import { eliminarIdea } from "@/app/ideas/actions";
import { claveDiaLocal, horaLocal } from "@/lib/zona-horaria";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

type IdeaConRelaciones = Idea & {
  cuenta: Cuenta;
  colaboradoras: Cuenta[];
  producto: Producto | null;
  publicaciones: { estado: EstadoPublicacion; programadaPara: Date | null }[];
};

/** Fila colapsable del notebook: título + badge + Cuenta; expandida muestra descripción/guión/links. */
export function IdeaFilaExpandible({ idea, ahora }: { idea: IdeaConRelaciones; ahora: Date }) {
  const [abierta, setAbierta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eliminando, startTransition] = useTransition();
  const atrasada = esAtrasada(ahora, { ...idea, yaPromocionada: idea.publicaciones.some((p) => p.estado === "publicada") });

  function eliminar() {
    if (!window.confirm(`¿Eliminar "${idea.titulo}"? No se puede deshacer.`)) return;
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
      <div
        className={`flex w-20 shrink-0 flex-col items-center justify-center gap-0.5 border-r border-zinc-200 px-2 py-3 text-center ${
          atrasada ? "bg-rose-50" : "bg-zinc-50"
        }`}
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
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-4">
        <button
          type="button"
          onClick={() => setAbierta((valor) => !valor)}
          className="flex w-full flex-col gap-2 text-left"
          aria-expanded={abierta}
        >
          <span className="font-medium text-zinc-900">{idea.titulo}</span>
          <span className="flex flex-wrap items-center gap-1.5">
            {[idea.cuenta, ...idea.colaboradoras].map((cuenta) => (
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
            <div className="flex items-center justify-between gap-2">
              <a href={`/ideas/${idea.id}`} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
                Editar →
              </a>
              <button
                type="button"
                onClick={eliminar}
                disabled={eliminando}
                className="text-xs font-medium text-rose-600 hover:text-rose-700 disabled:opacity-50"
              >
                {eliminando ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
            {error && <p className="text-xs text-rose-700">{error}</p>}
          </div>
        )}
      </div>
    </li>
  );
}
