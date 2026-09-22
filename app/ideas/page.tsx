import { EstadoIdea } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { obtenerCuentaIdPermitida } from "@/lib/auth/cuenta-permitida";
import { FiltroCheckboxes } from "@/components/filtro-checkboxes";
import { parsearSeleccionMultiple } from "@/lib/parsear-seleccion-multiple";
import { IdeaFilaExpandible } from "@/components/idea-fila-expandible";
import { ETIQUETAS_POR_ESTADO_IDEA } from "@/components/etiqueta-estado-idea";
import { AppShell } from "@/components/app-shell";

// Mismo motivo que /publicar y /historial: la lista tiene que ser siempre
// fresca, no cacheable en build time.
export const dynamic = "force-dynamic";

const ESTADOS = [EstadoIdea.idea, EstadoIdea.guionada, EstadoIdea.grabada, EstadoIdea.enDrive] as const;

export default async function IdeasPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  const cuentaIdPermitida = await obtenerCuentaIdPermitida();

  const cuentas = await prisma.cuenta.findMany({
    where: cuentaIdPermitida ? { id: cuentaIdPermitida } : undefined,
    orderBy: { nombre: "asc" },
  });

  const cuentasFiltro = parsearSeleccionMultiple(
    params.cuentaId,
    cuentas.map((cuenta) => cuenta.id),
  );
  const estadosFiltro = parsearSeleccionMultiple(params.estado, ESTADOS);

  const ideas = await prisma.idea.findMany({
    where: {
      ...(cuentaIdPermitida
        ? { cuentaId: cuentaIdPermitida }
        : cuentasFiltro
          ? { cuentaId: { in: cuentasFiltro } }
          : {}),
      ...(estadosFiltro ? { estado: { in: estadosFiltro } } : {}),
    },
    orderBy: { creadaEn: "desc" },
    include: { cuenta: true, publicaciones: { select: { estado: true, programadaPara: true } } },
  });

  const ahora = new Date();

  return (
    <AppShell active="ideas">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Ideas</h1>
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- mismo patrón que el resto del panel, sin next/link */}
          <a
            href="/ideas/nueva"
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
          >
            Nueva idea
          </a>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FiltroCheckboxes
          name="cuentaId"
          etiqueta="Cuenta:"
          opciones={cuentas.map((cuenta) => ({ value: cuenta.id, label: cuenta.nombre }))}
          seleccionadas={cuentasFiltro}
        />
        <FiltroCheckboxes
          name="estado"
          etiqueta="Estado:"
          opciones={ESTADOS.map((estado) => ({ value: estado, label: ETIQUETAS_POR_ESTADO_IDEA[estado] }))}
          seleccionadas={estadosFiltro}
        />
      </div>

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
