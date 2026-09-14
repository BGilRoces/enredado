import type { Cuenta, Publicacion } from "@prisma/client";
import { etiquetaEstado } from "./etiqueta-estado";

/** Encabezado (Cuenta · tipo · estado) + motivo de falla, reusado en toda lista de Publicaciones. */
export function PublicacionResumen({
  publicacion,
  mostrarFecha,
}: {
  publicacion: Publicacion & { cuenta: Cuenta };
  mostrarFecha?: boolean;
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <span className="font-medium">
          {publicacion.cuenta.nombre} · {publicacion.tipo}
        </span>
        <span className="text-xs text-zinc-500">{etiquetaEstado(publicacion)}</span>
      </div>
      {mostrarFecha && (
        <p className="text-xs text-zinc-500">
          {publicacion.creadaEn.toISOString()} UTC
          {publicacion.programadaPara
            ? ` · programada para ${publicacion.programadaPara.toISOString()} UTC`
            : ""}
        </p>
      )}
      {publicacion.error && <p className="text-red-700">{publicacion.error}</p>}
    </>
  );
}
