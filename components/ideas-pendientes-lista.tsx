"use client";

import { claseBadgeEstadoIdea, etiquetaEstadoIdea } from "./etiqueta-estado-idea";
import type { IdeaEnCalendario } from "./calendario-mes";

/** Columna angosta con las Ideas sin calendarizar — se arrastran a un día del CalendarioMes para asignarles fecha/hora. */
export function IdeasPendientesLista({ ideas }: { ideas: IdeaEnCalendario[] }) {
  function onDragStart(e: React.DragEvent, idea: IdeaEnCalendario) {
    e.dataTransfer.setData("text/plain", JSON.stringify({ id: idea.id, titulo: idea.titulo }));
    e.dataTransfer.effectAllowed = "move";
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-zinc-700">Sin calendarizar</p>
      {ideas.length === 0 ? (
        <p className="text-xs text-zinc-500">No hay ideas pendientes de calendarizar.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ideas.map((idea) => (
            <li
              key={idea.id}
              draggable
              onDragStart={(e) => onDragStart(e, idea)}
              className="cursor-grab rounded-xl border border-zinc-200 bg-white p-2.5 text-xs shadow-sm transition-colors active:cursor-grabbing hover:bg-zinc-50"
              title="Arrastrá esta idea a un día del calendario"
            >
              <p className="truncate font-medium text-zinc-900">{idea.titulo}</p>
              <p className="mt-0.5 truncate text-zinc-500">
                {idea.cuentaNombre} · {idea.tipo}
              </p>
              <span
                className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${claseBadgeEstadoIdea(idea)}`}
              >
                {etiquetaEstadoIdea(idea)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
