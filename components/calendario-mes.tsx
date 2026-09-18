import type { DiaDeGrilla } from "@/lib/calendario/mes-en-grilla";
import { claseBadgeEstadoIdea } from "./etiqueta-estado-idea";
import type { IdeaConEstado } from "./etiqueta-estado-idea";

export interface IdeaEnCalendario extends IdeaConEstado {
  id: string;
  titulo: string;
  cuentaNombre: string;
}

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function claveDia(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/** Grilla mensual sin librería (no existe ninguna en el proyecto) — server component, sin JS de cliente. */
export function CalendarioMes({
  dias,
  ideasPorDia,
  hoyClave,
}: {
  dias: DiaDeGrilla[];
  ideasPorDia: Map<string, IdeaEnCalendario[]>;
  hoyClave: string;
}) {
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
          const ideasDelDia = ideasPorDia.get(clave) ?? [];
          return (
            <div
              key={clave}
              className={`flex min-h-24 flex-col gap-1 border-b border-r border-zinc-100 p-1.5 last:border-r-0 ${
                dia.delMesActual ? "bg-white" : "bg-zinc-50"
              }`}
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
                    title={`${idea.titulo} · ${idea.cuentaNombre}`}
                  >
                    {idea.titulo}
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
