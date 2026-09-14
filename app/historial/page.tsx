import { EstadoPublicacion } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { CuentaFiltroForm } from "@/components/cuenta-filtro-form";
import { PublicacionResumen } from "@/components/publicacion-resumen";
import { ETIQUETAS_POR_ESTADO } from "@/components/etiqueta-estado";

// Igual que /publicar: la lista tiene que ser siempre fresca, no cacheable
// en build time (ahí tampoco hay DATABASE_URL disponible).
export const dynamic = "force-dynamic";

const ESTADOS = [
  EstadoPublicacion.pendiente,
  EstadoPublicacion.publicando,
  EstadoPublicacion.publicada,
  EstadoPublicacion.fallida,
  EstadoPublicacion.bloqueadaPorLimite,
  EstadoPublicacion.cancelada,
] as const;

function esEstadoValido(valor: string): valor is EstadoPublicacion {
  return (ESTADOS as readonly string[]).includes(valor);
}

export default async function HistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const cuentaFiltro = typeof params.cuentaId === "string" ? params.cuentaId : "";
  const estadoParam = typeof params.estado === "string" ? params.estado : "";
  const estadoFiltro = esEstadoValido(estadoParam) ? estadoParam : "";

  const cuentas = await prisma.cuenta.findMany({ orderBy: { nombre: "asc" } });

  const publicaciones = await prisma.publicacion.findMany({
    where: {
      ...(cuentaFiltro ? { cuentaId: cuentaFiltro } : {}),
      ...(estadoFiltro ? { estado: estadoFiltro } : {}),
    },
    orderBy: { creadaEn: "desc" },
    take: 100,
    include: { cuenta: true, _count: { select: { archivos: true } } },
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Historial</h1>
        <a href="/publicar" className="text-sm underline">
          Publicar
        </a>
      </div>

      <CuentaFiltroForm cuentas={cuentas} cuentaSeleccionada={cuentaFiltro}>
        <select
          name="estado"
          defaultValue={estadoFiltro}
          className="rounded border border-zinc-300 p-2 text-sm"
        >
          <option value="">Todos los estados</option>
          {ESTADOS.map((estado) => (
            <option key={estado} value={estado}>
              {ETIQUETAS_POR_ESTADO[estado]}
            </option>
          ))}
        </select>
      </CuentaFiltroForm>

      {publicaciones.length === 0 ? (
        <p className="text-sm text-zinc-500">No hay Publicaciones que coincidan con el filtro.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {publicaciones.map((publicacion) => (
            <li
              key={publicacion.id}
              className="flex flex-col gap-1 rounded border border-zinc-200 p-3 text-sm"
            >
              <PublicacionResumen publicacion={publicacion} mostrarFecha />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
