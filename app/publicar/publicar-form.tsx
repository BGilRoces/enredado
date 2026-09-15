"use client";

import { useRef, useState } from "react";
import { crearPublicacion } from "./actions";
import { useGooglePicker } from "./use-google-picker";

interface CuentaOption {
  id: string;
  nombre: string;
  igUsername: string;
}

type TipoPublicacionOption = "post" | "historia" | "reel";

const TIPOS: { value: TipoPublicacionOption; label: string }[] = [
  { value: "post", label: "Post" },
  { value: "historia", label: "Historia" },
  { value: "reel", label: "Reel" },
];

const MENSAJE_POR_ESTADO: Record<string, string> = {
  publicada: "Publicado en Instagram.",
  pendiente: "en cola",
  publicando: "publicando ahora",
  fallida: "falló",
};

/** Límite fijo de Instagram: un carousel admite entre 2 y 10 elementos. */
const MAX_ARCHIVOS_CAROUSEL = 10;

export function PublicarForm({ cuentas }: { cuentas: CuentaOption[] }) {
  const {
    archivos,
    elegirDeDrive,
    quitarArchivo,
    moverArchivo,
    moverArchivoA,
    limpiarSeleccion,
    error: errorPicker,
  } = useGooglePicker();
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id ?? "");
  const [tipoPublicacion, setTipoPublicacion] = useState<TipoPublicacionOption>("post");
  const [caption, setCaption] = useState("");
  const [cuando, setCuando] = useState<"ahora" | "programar">("ahora");
  const [programadaPara, setProgramadaPara] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [errorPublicar, setErrorPublicar] = useState<string | null>(null);
  const [indiceArrastrado, setIndiceArrastrado] = useState<number | null>(null);
  // Solo un ref porque el índice de origen no necesita disparar renders — se
  // lee una sola vez, en el onDrop.
  const dragOrigenRef = useRef<number | null>(null);

  const error = errorPublicar ?? errorPicker;
  const demasiadosParaCarousel = tipoPublicacion === "post" && archivos.length > MAX_ARCHIVOS_CAROUSEL;

  function onTipoPublicacionChange(tipo: TipoPublicacionOption) {
    setTipoPublicacion(tipo);
    limpiarSeleccion();
  }

  async function onSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    if (archivos.length === 0 || demasiadosParaCarousel) return;
    setEnviando(true);
    setErrorPublicar(null);
    setMensaje(null);
    try {
      const resultados = await crearPublicacion({
        cuentaId,
        archivos: archivos.map((a) => ({ driveFileId: a.id, resourceKey: a.resourceKey })),
        driveAccessToken: archivos[0].accessToken,
        tipoPublicacion,
        caption,
        programadaPara: cuando === "programar" && programadaPara ? new Date(programadaPara) : null,
      });
      const fallidas = resultados.filter((r) => r.estado === "fallida");
      if (fallidas.length === resultados.length) {
        setErrorPublicar(fallidas[0]?.error ?? "Falló, sin más detalle.");
      } else {
        const resumen = resultados
          .map((r) => MENSAJE_POR_ESTADO[r.estado] ?? r.estado)
          .join(", ");
        setMensaje(resultados.length > 1 ? `${resultados.length} Publicaciones: ${resumen}.` : `${resumen}.`);
        if (fallidas.length > 0) {
          setErrorPublicar(fallidas.map((f) => f.error).filter(Boolean).join(" / "));
        }
      }
      limpiarSeleccion();
    } catch (err) {
      setErrorPublicar(err instanceof Error ? err.message : String(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => elegirDeDrive({ multiple: tipoPublicacion !== "reel" })}
          className="self-start rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
        >
          Elegir de Google Drive
        </button>
        {archivos.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
            {archivos.map((a, i) => (
              <li
                key={a.id}
                draggable={archivos.length > 1}
                onDragStart={() => {
                  dragOrigenRef.current = i;
                  setIndiceArrastrado(i);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const origen = dragOrigenRef.current;
                  dragOrigenRef.current = null;
                  setIndiceArrastrado(null);
                  if (origen === null || origen === i) return;
                  moverArchivoA(archivos[origen].id, i);
                }}
                onDragEnd={() => {
                  dragOrigenRef.current = null;
                  setIndiceArrastrado(null);
                }}
                className={`flex items-center gap-2 text-sm text-zinc-600 ${
                  archivos.length > 1 ? "cursor-grab active:cursor-grabbing" : ""
                } ${indiceArrastrado === i ? "opacity-40" : ""}`}
              >
                {archivos.length > 1 && (
                  <span
                    className="select-none text-zinc-300"
                    aria-hidden="true"
                    title="Arrastrá para reordenar"
                  >
                    ⠿
                  </span>
                )}
                {a.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- viene de Drive, no de next/image
                  <img
                    src={a.thumbnailUrl}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-md object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                )}
                {archivos.length > 1 && (
                  <span className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => moverArchivo(a.id, -1)}
                      disabled={i === 0}
                      className="text-xs leading-none text-zinc-400 hover:text-zinc-700 disabled:opacity-20"
                      aria-label={`Subir ${a.nombre}`}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => moverArchivo(a.id, 1)}
                      disabled={i === archivos.length - 1}
                      className="text-xs leading-none text-zinc-400 hover:text-zinc-700 disabled:opacity-20"
                      aria-label={`Bajar ${a.nombre}`}
                    >
                      ▼
                    </button>
                  </span>
                )}
                <span className="flex-1">
                  {archivos.length > 1 && `${i + 1}. `}
                  {a.nombre}
                </span>
                <button
                  type="button"
                  onClick={() => quitarArchivo(a.id)}
                  className="text-xs text-zinc-400 hover:text-rose-600"
                  aria-label={`Sacar ${a.nombre}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        {tipoPublicacion === "post" && archivos.length > 1 && !demasiadosParaCarousel && (
          <span className="text-xs text-zinc-500">
            Se van a subir como un carousel ({archivos.length} elementos).
          </span>
        )}
        {demasiadosParaCarousel && (
          <span className="text-xs text-rose-700">
            Instagram permite hasta {MAX_ARCHIVOS_CAROUSEL} elementos por carousel — sacá alguno.
          </span>
        )}
        {tipoPublicacion === "historia" && archivos.length > 1 && (
          <span className="text-xs text-zinc-500">
            Se van a crear {archivos.length} Historias, una por cada foto.
          </span>
        )}
      </div>

      <label className="flex flex-col gap-1 text-sm text-zinc-700">
        Tipo de Publicación
        <select
          value={tipoPublicacion}
          onChange={(e) => onTipoPublicacionChange(e.target.value as TipoPublicacionOption)}
          className="rounded-lg border border-zinc-300 p-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        >
          {TIPOS.map((tipo) => (
            <option key={tipo.value} value={tipo.value}>
              {tipo.label}
            </option>
          ))}
        </select>
        {tipoPublicacion === "reel" && (
          <span className="text-xs text-zinc-500">Un Reel siempre es video.</span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm text-zinc-700">
        Cuenta de Instagram
        <select
          value={cuentaId}
          onChange={(e) => setCuentaId(e.target.value)}
          className="rounded-lg border border-zinc-300 p-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        >
          {cuentas.map((cuenta) => (
            <option key={cuenta.id} value={cuenta.id}>
              {cuenta.nombre} (@{cuenta.igUsername})
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-zinc-700">
        Caption
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={3}
          className="rounded-lg border border-zinc-300 p-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
      </label>

      <fieldset className="flex flex-col gap-2 text-sm text-zinc-700">
        <legend className="mb-1 font-medium text-zinc-900">Cuándo</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={cuando === "ahora"}
            onChange={() => setCuando("ahora")}
            className="accent-indigo-600"
          />
          Ahora
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={cuando === "programar"}
            onChange={() => setCuando("programar")}
            className="accent-indigo-600"
          />
          Programar para
        </label>
        {cuando === "programar" && (
          <input
            type="datetime-local"
            value={programadaPara}
            onChange={(e) => setProgramadaPara(e.target.value)}
            required
            className="rounded-lg border border-zinc-300 p-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        )}
        {cuando === "programar" && (
          <span className="text-xs text-zinc-500">Hora UTC (no la de tu huso horario).</span>
        )}
      </fieldset>

      <button
        type="submit"
        disabled={archivos.length === 0 || demasiadosParaCarousel || enviando}
        className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-40"
      >
        {enviando ? "Enviando..." : cuando === "programar" ? "Programar" : "Publicar ahora"}
      </button>

      {mensaje && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{mensaje}</p>}
      {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    </form>
  );
}
