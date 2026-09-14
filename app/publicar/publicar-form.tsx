"use client";

import { useState } from "react";
import { publicarEnInstagram } from "./actions";
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

export function PublicarForm({ cuentas }: { cuentas: CuentaOption[] }) {
  const { archivo, elegirDeDrive, error: errorPicker } = useGooglePicker();
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id ?? "");
  const [tipoPublicacion, setTipoPublicacion] = useState<TipoPublicacionOption>("post");
  const [caption, setCaption] = useState("");
  const [estado, setEstado] = useState<"idle" | "publicando" | "publicada" | "fallida">("idle");
  const [errorPublicar, setErrorPublicar] = useState<string | null>(null);

  const error = errorPublicar ?? errorPicker;

  async function onSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    if (!archivo) return;
    setEstado("publicando");
    setErrorPublicar(null);
    try {
      const resultado = await publicarEnInstagram({
        cuentaId,
        driveFileId: archivo.id,
        driveAccessToken: archivo.accessToken,
        tipoPublicacion,
        caption,
      });
      if (resultado.estado === "publicada") {
        setEstado("publicada");
      } else {
        setEstado("fallida");
        setErrorPublicar(resultado.error);
      }
    } catch (err) {
      setEstado("fallida");
      setErrorPublicar(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={elegirDeDrive}
          className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium"
        >
          Elegir de Google Drive
        </button>
        {archivo && <span className="text-sm text-zinc-600">{archivo.nombre}</span>}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Tipo de Publicación
        <select
          value={tipoPublicacion}
          onChange={(e) => setTipoPublicacion(e.target.value as TipoPublicacionOption)}
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

      <button
        type="submit"
        disabled={!archivo || estado === "publicando"}
        className="rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
      >
        {estado === "publicando" ? "Publicando..." : "Publicar ahora"}
      </button>

      {estado === "publicada" && (
        <p className="rounded bg-green-50 p-3 text-sm text-green-700">Publicado en Instagram.</p>
      )}
      {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </form>
  );
}
