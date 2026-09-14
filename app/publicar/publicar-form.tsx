"use client";

import { useState } from "react";
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
        archivos: archivos.map((a) => ({ driveFileId: a.id })),
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
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => elegirDeDrive({ multiple: tipoPublicacion !== "reel" })}
          className="self-start rounded border border-zinc-300 px-3 py-2 text-sm font-medium"
        >
          Elegir de Google Drive
        </button>
        {archivos.length > 0 && (
          <ul className="flex flex-col gap-1">
            {archivos.map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-sm text-zinc-600">
                <span className="flex-1">{a.nombre}</span>
                <button
                  type="button"
                  onClick={() => quitarArchivo(a.id)}
                  className="text-xs text-zinc-400 hover:text-zinc-700"
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
          <span className="text-xs text-red-700">
            Instagram permite hasta {MAX_ARCHIVOS_CAROUSEL} elementos por carousel — sacá alguno.
          </span>
        )}
        {tipoPublicacion === "historia" && archivos.length > 1 && (
          <span className="text-xs text-zinc-500">
            Se van a crear {archivos.length} Historias, una por cada foto.
          </span>
        )}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Tipo de Publicación
        <select
          value={tipoPublicacion}
          onChange={(e) => onTipoPublicacionChange(e.target.value as TipoPublicacionOption)}
          className="rounded border border-zinc-300 p-2"
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

      <label className="flex flex-col gap-1 text-sm">
        Cuenta de Instagram
        <select
          value={cuentaId}
          onChange={(e) => setCuentaId(e.target.value)}
          className="rounded border border-zinc-300 p-2"
        >
          {cuentas.map((cuenta) => (
            <option key={cuenta.id} value={cuenta.id}>
              {cuenta.nombre} (@{cuenta.igUsername})
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Caption
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={3}
          className="rounded border border-zinc-300 p-2"
        />
      </label>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1 font-medium">Cuándo</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={cuando === "ahora"}
            onChange={() => setCuando("ahora")}
          />
          Ahora
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={cuando === "programar"}
            onChange={() => setCuando("programar")}
          />
          Programar para
        </label>
        {cuando === "programar" && (
          <input
            type="datetime-local"
            value={programadaPara}
            onChange={(e) => setProgramadaPara(e.target.value)}
            required
            className="rounded border border-zinc-300 p-2"
          />
        )}
        {cuando === "programar" && (
          <span className="text-xs text-zinc-500">Hora UTC (no la de tu huso horario).</span>
        )}
      </fieldset>

      <button
        type="submit"
        disabled={archivos.length === 0 || demasiadosParaCarousel || enviando}
        className="rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
      >
        {enviando ? "Enviando..." : cuando === "programar" ? "Programar" : "Publicar ahora"}
      </button>

      {mensaje && <p className="rounded bg-green-50 p-3 text-sm text-green-700">{mensaje}</p>}
      {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </form>
  );
}
