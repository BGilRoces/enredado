import type { Cuenta, Publicacion } from "@prisma/client";
import { claseBadgeEstado, etiquetaEstado } from "./etiqueta-estado";

/** Encabezado (Cuenta · tipo · estado) + motivo de falla, reusado en toda lista de Publicaciones. */
export function PublicacionResumen({
  publicacion,
  mostrarFecha,
}: {
  publicacion: Publicacion & { cuenta: Cuenta; _count?: { archivos: number } };
  mostrarFecha?: boolean;
}) {
  const cantidadArchivos = publicacion._count?.archivos ?? 0;
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-zinc-900">
          {publicacion.cuenta.nombre} · {publicacion.tipo}
          {cantidadArchivos > 1 && ` · carousel (${cantidadArchivos})`}
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${claseBadgeEstado(publicacion)}`}
        >
          {etiquetaEstado(publicacion)}
        </span>
      </div>
      {mostrarFecha && (
        <p className="text-xs text-zinc-500">
          {publicacion.creadaEn.toISOString()} UTC
          {publicacion.programadaPara
            ? ` · programada para ${publicacion.programadaPara.toISOString()} UTC`
            : ""}
        </p>
      )}
      {publicacion.error && <p className="text-sm text-rose-700">{publicacion.error}</p>}
    </>
  );
}
