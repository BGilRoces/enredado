"use client";

import { useState } from "react";
import type { DiaDeGrilla } from "@/lib/calendario/mes-en-grilla";
import { CalendarioMes, type IdeaEnCalendario } from "./calendario-mes";
import { IdeasPendientesLista } from "./ideas-pendientes-lista";

/**
 * Grilla del mes + lista de ideas sin fecha, compartiendo la idea "elegida"
 * con un toque (la alternativa a arrastrar, que en celu no existe). En celu
 * va primero el calendario y abajo las pendientes; en desktop, las pendientes
 * en una columna a la izquierda.
 */
export function CalendarioConPendientes({
  dias,
  ideasPorDia,
  hoyClave,
  ideasPendientes,
}: {
  dias: DiaDeGrilla[];
  ideasPorDia: Record<string, IdeaEnCalendario[]>;
  hoyClave: string;
  ideasPendientes: IdeaEnCalendario[];
}) {
  const [elegida, setElegida] = useState<IdeaEnCalendario | null>(null);

  function elegir(idea: IdeaEnCalendario | null) {
    setElegida(idea);
    // En celu la grilla queda arriba, fuera de vista: se sube para tocar el día.
    if (idea && !window.matchMedia("(min-width: 1024px)").matches) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="order-2 w-full shrink-0 lg:order-1 lg:w-64">
        <IdeasPendientesLista ideas={ideasPendientes} elegidaId={elegida?.id ?? null} alElegir={elegir} />
      </div>
      <div className="order-1 flex min-w-0 flex-1 flex-col gap-3 lg:order-2">
        {elegida && (
          <div className="sticky top-14 z-20 flex items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-900 md:top-2">
            <span className="min-w-0">
              Elegí el día para <span className="font-medium">{elegida.titulo}</span>
            </span>
            <button
              type="button"
              onClick={() => setElegida(null)}
              className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
            >
              Cancelar
            </button>
          </div>
        )}
        <CalendarioMes
          dias={dias}
          ideasPorDia={ideasPorDia}
          hoyClave={hoyClave}
          ideaParaProgramar={elegida ? { id: elegida.id, titulo: elegida.titulo } : null}
          alProgramar={() => setElegida(null)}
        />
      </div>
    </div>
  );
}
