import { EstadoIdea } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { obtenerCuentaIdPermitida } from "@/lib/auth/cuenta-permitida";
import { CuentaFiltroForm } from "@/components/cuenta-filtro-form";
import { IdeaFilaExpandible } from "@/components/idea-fila-expandible";
import { ETIQUETAS_POR_ESTADO_IDEA } from "@/components/etiqueta-estado-idea";
import { AppShell } from "@/components/app-shell";

// Mismo motivo que /publicar y /historial: la lista tiene que ser siempre
// fresca, no cacheable en build time.
export const dynamic = "force-dynamic";

const ESTADOS = [EstadoIdea.idea, EstadoIdea.guionada, EstadoIdea.grabada, EstadoIdea.enDrive] as const;

function esEstadoValido(valor: string): valor is EstadoIdea {
  return (ESTADOS as readonly string[]).includes(valor);
}

export default async function IdeasPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const cuentaFiltro = typeof params.cuentaId === "string" ? params.cuentaId : "";
  const estadoParam = typeof params.estado === "string" ? params.estado : "";
  const estadoFiltro = esEstadoValido(estadoParam) ? estadoParam : "";

  const cuentaIdPermitida = await obtenerCuentaIdPermitida();
  const cuentaId = cuentaIdPermitida ?? (cuentaFiltro || undefined);

  const cuentas = await prisma.cuenta.findMany({
    where: cuentaIdPermitida ? { id: cuentaIdPermitida } : undefined,
    orderBy: { nombre: "asc" },
  });

  const ideas = await prisma.idea.findMany({
    where: {
      ...(cuentaId ? { cuentaId } : {}),
      ...(estadoFiltro ? { estado: estadoFiltro } : {}),
    },
    orderBy: { creadaEn: "desc" },
    include: { cuenta: true, publicacion: { select: { estado: true, programadaPara: true } } },
  });

  const ahora = new Date();

  return (
    <AppShell active="ideas">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Ideas</h1>
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- mismo patrón que el resto del panel, sin next/link */}
          <a href="/ideas/calendario" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
            Calendario →
          </a>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- mismo patrón que el resto del panel, sin next/link */}
          <a
            href="/ideas/nueva"
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
          >
            Nueva idea
          </a>
        </div>
      </div>

      <CuentaFiltroForm cuentas={cuentas} cuentaSeleccionada={cuentaFiltro}>
        <select
          name="estado"
          defaultValue={estadoFiltro}
          className="rounded-lg border border-zinc-200 bg-white p-2 text-sm text-zinc-700 shadow-sm"
        >
          <option value="">Todos los estados</option>
          {ESTADOS.map((estado) => (
            <option key={estado} value={estado}>
              {ETIQUETAS_POR_ESTADO_IDEA[estado]}
            </option>
          ))}
        </select>
      </CuentaFiltroForm>

      {ideas.length === 0 ? (
        <p className="text-sm text-zinc-500">No hay ideas que coincidan con el filtro.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ideas.map((idea) => (
            <IdeaFilaExpandible key={idea.id} idea={idea} ahora={ahora} />
          ))}
        </ul>
      )}
    </AppShell>
  );
}
