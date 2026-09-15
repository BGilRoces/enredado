"use client";

import { useEffect, useRef, useState } from "react";
import { bajarThumbnail } from "./drive-thumbnail";
import type { ArchivoElegido } from "./use-google-picker";

/** Mismos mimeType que usa el Picker de Google en desktop (ver abrirPicker en use-google-picker.ts) — no restringir más acá. */
const MIME_TYPES_ACEPTADOS = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
];

const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const SHORTCUT_MIME_TYPE = "application/vnd.google-apps.shortcut";

/** Sentinel: no es un id real de Drive, `fetchCarpeta` lo reconoce y arma la query de "sharedWithMe" en vez de "in parents". */
const RAIZ_COMPARTIDOS = "sharedWithMe";

interface Nivel {
  id: string;
  nombre: string;
}

interface DriveApiFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  resourceKey?: string;
  shortcutDetails?: { targetId?: string; targetMimeType?: string; targetResourceKey?: string };
}

/** Carpeta navegable, ya sea real o una que apunta a través de un shortcut. */
interface ItemCarpeta {
  tipo: "carpeta";
  idParaNavegar: string;
  nombre: string;
}

/** Archivo elegible, con el id/resourceKey del shortcut original si vino por uno (ver resolverArchivoReal en client.ts). */
interface ItemArchivo {
  tipo: "archivo";
  id: string;
  nombre: string;
  mimeType: string;
  resourceKey?: string;
  thumbnailLink?: string;
}

type Item = ItemCarpeta | ItemArchivo;

function clasificar(file: DriveApiFile): Item | null {
  if (file.mimeType === FOLDER_MIME_TYPE) {
    return { tipo: "carpeta", idParaNavegar: file.id, nombre: file.name };
  }
  if (file.mimeType === SHORTCUT_MIME_TYPE) {
    const target = file.shortcutDetails;
    if (!target?.targetMimeType) return null;
    if (target.targetMimeType === FOLDER_MIME_TYPE) {
      if (!target.targetId) return null;
      return { tipo: "carpeta", idParaNavegar: target.targetId, nombre: file.name };
    }
    if (MIME_TYPES_ACEPTADOS.includes(target.targetMimeType)) {
      return {
        tipo: "archivo",
        id: file.id,
        nombre: file.name,
        mimeType: target.targetMimeType,
        resourceKey: file.resourceKey,
        thumbnailLink: file.thumbnailLink,
      };
    }
    return null;
  }
  if (MIME_TYPES_ACEPTADOS.includes(file.mimeType)) {
    return {
      tipo: "archivo",
      id: file.id,
      nombre: file.name,
      mimeType: file.mimeType,
      resourceKey: file.resourceKey,
      thumbnailLink: file.thumbnailLink,
    };
  }
  return null;
}

function construirQuery(folderId: string): string {
  const mimeTypes = [FOLDER_MIME_TYPE, SHORTCUT_MIME_TYPE, ...MIME_TYPES_ACEPTADOS]
    .map((m) => `mimeType = '${m}'`)
    .join(" or ");
  const base = folderId === RAIZ_COMPARTIDOS ? "sharedWithMe = true" : `'${folderId}' in parents`;
  return `${base} and trashed = false and (${mimeTypes})`;
}

interface Props {
  accessToken: string;
  multiple: boolean;
  onConfirm: (archivos: ArchivoElegido[]) => void;
  onClose: () => void;
}

export function DrivePickerMobile({ accessToken, multiple, onConfirm, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Vacío = pantalla raíz (elegir "Mi unidad" o "Compartido conmigo").
  const [pila, setPila] = useState<Nivel[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<Map<string, ArchivoElegido>>(new Map());
  // Data URLs (no blob: URL) — no hace falta revocar nada, y evita el bug de
  // que al confirmar la selección y cerrarse este modal se revoquen las
  // miniaturas de los archivos recién elegidos.
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  const carpetaActual = pila.at(-1)?.id ?? null;

  async function fetchCarpeta(folderId: string, pageToken?: string) {
    setCargando(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        q: construirQuery(folderId),
        fields: "files(id,name,mimeType,thumbnailLink,resourceKey,shortcutDetails),nextPageToken",
        pageSize: "60",
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
        orderBy: "folder,name",
      });
      if (pageToken) params.set("pageToken", pageToken);
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const cuerpo = await res.json().catch(() => null);
        throw new Error(cuerpo?.error?.message ?? `Google Drive respondió ${res.status}.`);
      }
      const data = await res.json();
      const nuevosItems = (data.files as DriveApiFile[]).map(clasificar).filter((i): i is Item => i !== null);
      setItems((actuales) => (pageToken ? [...actuales, ...nuevosItems] : nuevosItems));
      setNextPageToken(data.nextPageToken ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCargando(false);
    }
  }

  // Trae las miniaturas autenticadas de los archivos de esta página — thumbnailLink no es accesible sin el token.
  useEffect(() => {
    const controller = new AbortController();
    const archivos = items.filter((i): i is ItemArchivo => i.tipo === "archivo" && !!i.thumbnailLink);
    for (const archivo of archivos) {
      if (thumbnails[archivo.id]) continue;
      bajarThumbnail(archivo.thumbnailLink!, accessToken, controller.signal).then((dataUrl) => {
        if (!dataUrl) return;
        setThumbnails((actuales) => ({ ...actuales, [archivo.id]: dataUrl }));
      });
    }
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo depende de los items de la página actual.
  }, [items]);

  function abrirRaiz(id: string, nombre: string) {
    setItems([]);
    setPila([{ id, nombre }]);
    fetchCarpeta(id);
  }

  function navegarACarpeta(item: ItemCarpeta) {
    setItems([]);
    setPila((actual) => [...actual, { id: item.idParaNavegar, nombre: item.nombre }]);
    fetchCarpeta(item.idParaNavegar);
  }

  function irANivel(indice: number) {
    setItems([]);
    setPila((actual) => actual.slice(0, indice + 1));
    fetchCarpeta(pila[indice].id);
  }

  function volverARaiz() {
    setItems([]);
    setPila([]);
  }

  function archivoElegido(item: ItemArchivo): ArchivoElegido {
    return {
      id: item.id,
      nombre: item.nombre,
      mimeType: item.mimeType,
      accessToken,
      resourceKey: item.resourceKey,
      thumbnailUrl: thumbnails[item.id],
    };
  }

  function tocarArchivo(item: ItemArchivo) {
    if (!multiple) {
      onConfirm([archivoElegido(item)]);
      return;
    }
    setSeleccion((actual) => {
      const copia = new Map(actual);
      if (copia.has(item.id)) copia.delete(item.id);
      else copia.set(item.id, archivoElegido(item));
      return copia;
    });
  }

  const carpetas = items.filter((i): i is ItemCarpeta => i.tipo === "carpeta");
  const archivos = items.filter((i): i is ItemArchivo => i.tipo === "archivo");

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={onClose}
      className="m-0 h-dvh max-h-none w-full max-w-none border-0 bg-white p-0 backdrop:bg-black/40"
    >
      <div className="flex h-dvh flex-col">
        <div className="flex items-center gap-2 border-b border-zinc-200 p-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100"
            aria-label="Cerrar"
          >
            ✕
          </button>
          <div className="flex flex-1 flex-wrap items-center gap-1 text-sm">
            <button
              type="button"
              onClick={volverARaiz}
              className={`rounded-lg px-2 py-1 ${pila.length === 0 ? "font-medium text-zinc-900" : "text-indigo-600 hover:bg-indigo-50"}`}
            >
              Drive
            </button>
            {pila.map((nivel, i) => (
              <span key={nivel.id} className="flex items-center gap-1">
                <span className="text-zinc-300">/</span>
                <button
                  type="button"
                  onClick={() => irANivel(i)}
                  className={`rounded-lg px-2 py-1 ${
                    i === pila.length - 1 ? "font-medium text-zinc-900" : "text-indigo-600 hover:bg-indigo-50"
                  }`}
                >
                  {nivel.nombre}
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {pila.length === 0 && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => abrirRaiz("root", "Mi unidad")}
                className="rounded-lg border border-zinc-200 p-4 text-left text-sm font-medium text-zinc-900 hover:bg-zinc-50"
              >
                📁 Mi unidad
              </button>
              <button
                type="button"
                onClick={() => abrirRaiz(RAIZ_COMPARTIDOS, "Compartido conmigo")}
                className="rounded-lg border border-zinc-200 p-4 text-left text-sm font-medium text-zinc-900 hover:bg-zinc-50"
              >
                👥 Compartido conmigo
              </button>
            </div>
          )}

          {pila.length > 0 && (
            <>
              {error && <p className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

              {carpetas.length > 0 && (
                <ul className="mb-3 flex flex-col gap-1">
                  {carpetas.map((carpeta) => (
                    <li key={carpeta.idParaNavegar}>
                      <button
                        type="button"
                        onClick={() => navegarACarpeta(carpeta)}
                        className="flex w-full min-h-[44px] items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-left text-sm text-zinc-900 hover:bg-zinc-50"
                      >
                        <span aria-hidden="true">📁</span>
                        {carpeta.nombre}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {archivos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {archivos.map((item) => {
                    const marcado = seleccion.has(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => tocarArchivo(item)}
                        className={`relative aspect-square overflow-hidden rounded-lg border-2 ${
                          marcado ? "border-indigo-600" : "border-zinc-200"
                        }`}
                      >
                        {thumbnails[item.id] ? (
                          // eslint-disable-next-line @next/next/no-img-element -- viene de Drive, no de next/image
                          <img src={thumbnails[item.id]} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center bg-zinc-100 p-1 text-center text-xs text-zinc-500">
                            {item.nombre}
                          </span>
                        )}
                        {multiple && (
                          <span
                            className={`absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                              marcado ? "bg-indigo-600 text-white" : "bg-white/80 text-zinc-400"
                            }`}
                            aria-hidden="true"
                          >
                            {marcado ? "✓" : ""}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {!cargando && carpetas.length === 0 && archivos.length === 0 && !error && (
                <p className="p-4 text-center text-sm text-zinc-500">Carpeta vacía.</p>
              )}

              {cargando && <p className="p-4 text-center text-sm text-zinc-500">Cargando…</p>}

              {nextPageToken && !cargando && (
                <button
                  type="button"
                  onClick={() => carpetaActual && fetchCarpeta(carpetaActual, nextPageToken)}
                  className="mt-2 w-full rounded-lg border border-zinc-200 p-2 text-sm text-indigo-600 hover:bg-indigo-50"
                >
                  Cargar más
                </button>
              )}
            </>
          )}
        </div>

        {multiple && seleccion.size > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-zinc-200 bg-white p-3">
            <span className="text-sm text-zinc-600">{seleccion.size} seleccionados</span>
            <button
              type="button"
              onClick={() => onConfirm([...seleccion.values()])}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Usar selección
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
