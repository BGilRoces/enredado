"use client";

import { useState, useTransition } from "react";
import type { IdeaArchivo } from "@prisma/client";
import { mensajeDeError } from "@/lib/mensaje-de-error";
import { eliminarArchivoIdea, reordenarArchivosIdea } from "@/app/ideas/actions";

/**
 * Lista de archivos de la carpeta cargada en una Idea: drag-and-drop para
 * reordenar y un botón para sacar los que no se quieren subir (sin tocar
 * Drive, ver eliminarArchivoIdea). Reordena optimista en el cliente —
 * confirma contra el server en segundo plano y revierte si falla.
 */
export function CarpetaIdeaArchivos({
  ideaId,
  archivosIniciales,
}: {
  ideaId: string;
  archivosIniciales: Pick<IdeaArchivo, "id" | "nombre" | "driveFileId">[];
}) {
  const [archivos, setArchivos] = useState(archivosIniciales);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function reordenar(idsEnOrden: string[], anterior: typeof archivos) {
    setError(null);
    startTransition(async () => {
      try {
        await reordenarArchivosIdea(ideaId, idsEnOrden);
      } catch (err) {
        setArchivos(anterior);
        setError(mensajeDeError(err));
      }
    });
  }

  function onDrop(idDestino: string) {
    if (!arrastrando || arrastrando === idDestino) {
      setArrastrando(null);
      return;
    }
    const anterior = archivos;
    const origen = archivos.findIndex((a) => a.id === arrastrando);
    const destino = archivos.findIndex((a) => a.id === idDestino);
    setArrastrando(null);
    if (origen === -1 || destino === -1) return;

    const reordenados = [...archivos];
    const [movido] = reordenados.splice(origen, 1);
    reordenados.splice(destino, 0, movido);
    setArchivos(reordenados);
    reordenar(reordenados.map((a) => a.id), anterior);
  }

  function eliminar(archivoId: string) {
    const anterior = archivos;
    setError(null);
    setArchivos((actuales) => actuales.filter((a) => a.id !== archivoId));
    startTransition(async () => {
      try {
        await eliminarArchivoIdea(ideaId, archivoId);
      } catch (err) {
        setArchivos(anterior);
        setError(mensajeDeError(err));
      }
    });
  }

  return (
    <div className="mt-2 flex flex-col gap-1">
      <p className="text-sm font-medium text-zinc-700">
        Orden de la carpeta ({archivos.length} archivo{archivos.length === 1 ? "" : "s"}) — arrastrá para reordenar
      </p>
      <ul className="flex flex-col gap-1">
        {archivos.map((archivo) => (
          <li
            key={archivo.id}
            draggable
            onDragStart={() => setArrastrando(archivo.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(archivo.id)}
            onDragEnd={() => setArrastrando(null)}
            className={`flex cursor-grab items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white p-2 text-xs active:cursor-grabbing ${
              arrastrando === archivo.id ? "opacity-40" : ""
            }`}
          >
            <span className="flex items-center gap-2 truncate text-zinc-700">
              <span className="text-zinc-400">⠿</span>
              {archivo.nombre ?? archivo.driveFileId}
            </span>
            <button
              type="button"
              onClick={() => eliminar(archivo.id)}
              disabled={archivos.length <= 1}
              title={archivos.length <= 1 ? "No podés sacar el último archivo" : "Sacar de la carpeta"}
              className="shrink-0 rounded border border-zinc-300 px-1.5 py-0.5 text-rose-700 transition-colors hover:bg-rose-50 disabled:opacity-30"
            >
              Sacar
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="text-xs text-rose-700">{error}</p>}
    </div>
  );
}
