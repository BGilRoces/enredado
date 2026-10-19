"use client";

import { claseBadgeEstadoIdea, etiquetaEstadoIdea } from "./etiqueta-estado-idea";
import type { IdeaEnCalendario } from "./calendario-mes";

/**
 * Columna angosta con las Ideas sin calendarizar — se arrastran a un día del
 * CalendarioMes para asignarles fecha/hora. En celu (sin drag-and-drop) se
 * toca una para elegirla y después se toca el día.
 */
export function IdeasPendientesLista({
  ideas,
  elegidaId,
  alElegir,
}: {
  ideas: IdeaEnCalendario[];
  elegidaId: string | null;
  alElegir: (idea: IdeaEnCalendario | null) => void;
}) {
  function onDragStart(e: React.DragEvent, idea: IdeaEnCalendario) {
    e.dataTransfer.setData("text/plain", JSON.stringify({ id: idea.id, titulo: idea.titulo }));
    e.dataTransfer.effectAllowed = "move";
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col">
        <p className="text-sm font-medium text-zinc-700">Sin calendarizar</p>
        {ideas.length > 0 && (
          <p className="text-xs text-zinc-500">
            <span className="md:hidden">Tocá una y después el día del calendario.</span>
            <span className="hidden md:inline">Arrastrá una a un día, o tocala y después tocá el día.</span>
          </p>
        )}
      </div>
      {ideas.length === 0 ? (
        <p className="text-xs text-zinc-500">No hay ideas pendientes de calendarizar.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ideas.map((idea) => {
            const elegida = idea.id === elegidaId;
            return (
              <li key={idea.id}>
                {/* div y no <button>: Firefox no deja arrastrar botones. */}
                <div
                  role="button"
                  tabIndex={0}
                  draggable
                  onDragStart={(e) => onDragStart(e, idea)}
                  onClick={() => alElegir(elegida ? null : idea)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault();
                    alElegir(elegida ? null : idea);
                  }}
                  aria-pressed={elegida}
                  className={`w-full cursor-grab rounded-xl border bg-white p-2.5 text-left text-xs shadow-sm transition-colors active:cursor-grabbing ${
                    elegida ? "border-indigo-400 ring-2 ring-indigo-200" : "border-zinc-200 hover:bg-zinc-50"
                  }`}
                >
                  <p className="truncate font-medium text-zinc-900">{idea.titulo}</p>
                  <p className="mt-0.5 truncate text-zinc-500">
                    {idea.cuentaNombre}{idea.productoNombre ? ` · ${idea.productoNombre}` : ""} · {idea.tipo}
                  </p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${claseBadgeEstadoIdea(idea)}`}
                  >
                    {etiquetaEstadoIdea(idea)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
