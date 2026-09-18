"use client";

import { useState } from "react";
import type { Cuenta, EstadoPublicacion, Idea } from "@prisma/client";
import { claseBadgeEstadoIdea, etiquetaEstadoIdea } from "./etiqueta-estado-idea";
import { esAtrasada } from "@/lib/ideas/es-atrasada";

type IdeaConRelaciones = Idea & {
  cuenta: Cuenta;
  publicacion: { estado: EstadoPublicacion; programadaPara: Date | null } | null;
};

/** Fila colapsable del notebook: título + badge + Cuenta; expandida muestra descripción/guión/links. */
export function IdeaFilaExpandible({ idea, ahora }: { idea: IdeaConRelaciones; ahora: Date }) {
  const [abierta, setAbierta] = useState(false);
  const atrasada = esAtrasada(ahora, idea);

  return (
    <li className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm">
      <button
        type="button"
        onClick={() => setAbierta((valor) => !valor)}
        className="flex w-full flex-col gap-1 text-left"
        aria-expanded={abierta}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-zinc-900">
            {idea.titulo}
            <span className="ml-2 font-normal text-zinc-500">
              {idea.cuenta.nombre} · {idea.tipo}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {atrasada && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                Atrasada
              </span>
            )}
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${claseBadgeEstadoIdea(idea)}`}>
              {etiquetaEstadoIdea(idea)}
            </span>
          </span>
        </div>
        {idea.programadaPara && (
          <p className="text-xs text-zinc-500">{idea.programadaPara.toISOString()} UTC</p>
        )}
      </button>
      {abierta && (
        <div className="mt-3 flex flex-col gap-2 text-sm text-zinc-700">
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
          <a href={`/ideas/${idea.id}`} className="w-fit text-xs font-medium text-indigo-600 hover:text-indigo-700">
            Editar →
          </a>
        </div>
      )}
    </li>
  );
}
