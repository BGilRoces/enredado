"use client";

import { useState } from "react";
import type { Cuenta, Publicacion, PublicacionArchivo, TipoMedia } from "@prisma/client";
import { PublicacionResumen } from "./publicacion-resumen";

interface ArchivoPreview {
  tipoMedia: TipoMedia;
  storageUrl: string;
}

/** Fila de PublicacionResumen que al tocarla despliega las fotos/videos de esa Publicación. */
export function PublicacionFilaExpandible({
  publicacion,
}: {
  publicacion: Publicacion & {
    cuenta: Cuenta;
    archivos: PublicacionArchivo[];
    _count?: { archivos: number };
  };
}) {
  const [abierta, setAbierta] = useState(false);

  // Un carousel trae sus archivos en `archivos` (ver ADR-0011); el caso
  // simple usa los campos sueltos de la Publicación.
  const archivos: ArchivoPreview[] =
    publicacion.archivos.length > 0
      ? publicacion.archivos.map((a) => ({ tipoMedia: a.tipoMedia, storageUrl: a.storageUrl }))
      : publicacion.storageUrl && publicacion.tipoMedia
        ? [{ tipoMedia: publicacion.tipoMedia, storageUrl: publicacion.storageUrl }]
        : [];

  return (
    <li className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm">
      <button
        type="button"
        onClick={() => setAbierta((valor) => !valor)}
        className="flex w-full flex-col gap-1 text-left"
        aria-expanded={abierta}
      >
        <PublicacionResumen publicacion={publicacion} />
      </button>
      {abierta &&
        (archivos.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {archivos.map((archivo, i) =>
              archivo.tipoMedia === "imagen" ? (
                // eslint-disable-next-line @next/next/no-img-element -- viene de Supabase Storage, no de next/image
                <img
                  key={i}
                  src={archivo.storageUrl}
                  alt=""
                  className="h-20 w-20 rounded-lg border border-zinc-200 object-cover"
                />
              ) : (
                <video
                  key={i}
                  src={archivo.storageUrl}
                  muted
                  className="h-20 w-20 rounded-lg border border-zinc-200 object-cover"
                />
              )
            )}
          </div>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">No hay vista previa disponible.</p>
        ))}
    </li>
  );
}
