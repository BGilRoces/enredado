import { redirect } from "next/navigation";
import { TipoPublicacion } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { obtenerCuentaIdPermitida } from "@/lib/auth/cuenta-permitida";
import { mensajeDeError } from "@/lib/mensaje-de-error";
import { crearIdea } from "../actions";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

const TIPOS: { value: TipoPublicacion; label: string }[] = [
  { value: TipoPublicacion.post, label: "Post" },
  { value: TipoPublicacion.historia, label: "Historia" },
  { value: TipoPublicacion.reel, label: "Reel" },
];

const INPUT_CLASS =
  "rounded-lg border border-zinc-300 p-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export default async function NuevaIdeaPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { error } = await searchParams;
  const cuentaIdPermitida = await obtenerCuentaIdPermitida();
  const cuentas = await prisma.cuenta.findMany({
    where: cuentaIdPermitida ? { id: cuentaIdPermitida } : undefined,
    orderBy: { nombre: "asc" },
  });

  async function crear(formData: FormData) {
    "use server";
    // El redirect de éxito queda fuera del try/catch a propósito (ver
    // app/ideas/[id]/page.tsx): redirect() tira una excepción especial que
    // un catch genérico atraparía como si fuera un error real.
    let id: string;
    try {
      id = await crearIdea({
        cuentaId: String(formData.get("cuentaId") ?? ""),
        titulo: String(formData.get("titulo") ?? ""),
        tipo: String(formData.get("tipo") ?? "post") as TipoPublicacion,
        descripcion: String(formData.get("descripcion") ?? ""),
        guion: String(formData.get("guion") ?? ""),
        linkReferencia1: String(formData.get("linkReferencia1") ?? ""),
        linkReferencia2: String(formData.get("linkReferencia2") ?? ""),
      });
    } catch (err) {
      redirect(`/ideas/nueva?error=${encodeURIComponent(mensajeDeError(err))}`);
    }
    redirect(`/ideas/${id}`);
  }

  return (
    <AppShell active="ideas">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Nueva idea</h1>

      {typeof error === "string" && (
        <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>
      )}

      {cuentas.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No hay Cuentas conectadas.{" "}
          <a href="/cuentas" className="font-medium text-indigo-600 hover:text-indigo-700">
            Conectá una
          </a>{" "}
          primero.
        </p>
      ) : (
        <form action={crear} className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex gap-2">
            <select name="cuentaId" required className={`${INPUT_CLASS} flex-1`}>
              {cuentas.map((cuenta) => (
                <option key={cuenta.id} value={cuenta.id}>
                  {cuenta.nombre}
                </option>
              ))}
            </select>
            <select name="tipo" defaultValue={TipoPublicacion.post} className={INPUT_CLASS}>
              {TIPOS.map((tipo) => (
                <option key={tipo.value} value={tipo.value}>
                  {tipo.label}
                </option>
              ))}
            </select>
          </div>
          <input name="titulo" required placeholder="Título" className={INPUT_CLASS} />
          <textarea
            name="descripcion"
            placeholder="Mini-descripción: de qué se trata"
            rows={2}
            className={INPUT_CLASS}
          />
          <textarea name="guion" placeholder="Guión (opcional)" rows={5} className={INPUT_CLASS} />
          <input name="linkReferencia1" placeholder="Link de referencia 1 (opcional)" className={INPUT_CLASS} />
          <input name="linkReferencia2" placeholder="Link de referencia 2 (opcional)" className={INPUT_CLASS} />
          <button
            type="submit"
            className="self-start rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
          >
            Guardar idea
          </button>
        </form>
      )}
    </AppShell>
  );
}
