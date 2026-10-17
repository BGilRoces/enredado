import { EstadoIdea } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { whereCuentasIdea, wherePublicadaIdea } from "@/lib/ideas/cuentas-de-idea";
import { obtenerCuentaIdPermitida } from "@/lib/auth/cuenta-permitida";
import { FiltroCheckboxes } from "@/components/filtro-checkboxes";
import { parsearSeleccionMultiple } from "@/lib/parsear-seleccion-multiple";
import { IdeaFilaExpandible } from "@/components/idea-fila-expandible";
import { ESTADOS_LISTOS_PARA_PROGRAMAR, ETIQUETAS_POR_ESTADO_IDEA } from "@/components/etiqueta-estado-idea";
import { AppShell } from "@/components/app-shell";
import { opcionesProducto, parsearFiltroProductos, whereProducto } from "@/lib/productos/filtro";

// Mismo motivo que /publicar y /historial: la lista tiene que ser siempre
// fresca, no cacheable en build time.
export const dynamic = "force-dynamic";

const ESTADOS = [EstadoIdea.idea, EstadoIdea.guionada, EstadoIdea.grabada, EstadoIdea.editada, EstadoIdea.enDrive] as const;

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
  // Productos de las Cuentas visibles (las tildadas en el filtro de Cuenta).
  const cuentasVisibles = cuentaIdPermitida ? [cuentaIdPermitida] : (cuentasFiltro ?? cuentas.map((c) => c.id));
  const productos = await prisma.producto.findMany({
    where: { cuentaId: { in: cuentasVisibles } },
    orderBy: [{ cuenta: { nombre: "asc" } }, { nombre: "asc" }],
    include: { cuenta: { select: { nombre: true } } },
  });
  const opcionesProductos = opcionesProducto(productos);
  const productosFiltro = parsearFiltroProductos(
    params.productoId,
    opcionesProductos.map((o) => o.value),
  );
  const estadosFiltro = parsearSeleccionMultiple(params.estado, ESTADOS);
  const soloFaltaProgramar = params.faltaIg === "1";
  const verPublicadas = params.publicadas === "1";

  const ideas = await prisma.idea.findMany({
    where: {
      // Un solo AND con todo: whereCuentasIdea y wherePublicadaIdea usan OR/AND y no se pueden spreadear juntos.
      AND: [
        whereCuentasIdea(cuentaIdPermitida ? [cuentaIdPermitida] : cuentasFiltro),
        wherePublicadaIdea(verPublicadas),
      ],
      ...whereProducto(productosFiltro),
      ...(estadosFiltro ? { estado: { in: estadosFiltro } } : {}),
      ...(soloFaltaProgramar
        ? { estado: { in: ESTADOS_LISTOS_PARA_PROGRAMAR }, programadaPara: { not: null }, programadaEnIgEl: null }
        : {}),
    },
    // Por fecha programada (las más próximas primero); las que no tienen fecha, al final.
    orderBy: [{ programadaPara: { sort: "asc", nulls: "last" } }, { creadaEn: "desc" }],
    include: { cuenta: true, colaboradoras: true, producto: true, publicaciones: { select: { estado: true, programadaPara: true } } },
  });

  const ahora = new Date();

  return (
    <AppShell active="ideas" ancho="completo">
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
        <a
          href={soloFaltaProgramar ? "/ideas" : "/ideas?faltaIg=1"}
          className={
            soloFaltaProgramar
              ? "rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white"
              : "rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-50"
          }
        >
          Falta programar
        </a>
        <a
          href={verPublicadas ? "/ideas" : "/ideas?publicadas=1"}
          className={
            verPublicadas
              ? "rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white"
              : "rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
          }
        >
          {verPublicadas ? "Volver a las ideas" : "Ver publicadas"}
        </a>
        <FiltroCheckboxes
          name="cuentaId"
          etiqueta="Cuenta:"
          opciones={cuentas.map((cuenta) => ({ value: cuenta.id, label: cuenta.nombre }))}
          seleccionadas={cuentasFiltro}
        />
        {opcionesProductos.length > 0 && (
          <FiltroCheckboxes
            name="productoId"
            etiqueta="Producto:"
            opciones={opcionesProductos}
            seleccionadas={productosFiltro}
          />
        )}
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
