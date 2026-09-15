import { EstadoPublicacion } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { obtenerCuentaIdPermitida } from "@/lib/auth/cuenta-permitida";
import { CuentaFiltroForm } from "@/components/cuenta-filtro-form";
import { PublicacionResumen } from "@/components/publicacion-resumen";
import { ETIQUETAS_POR_ESTADO } from "@/components/etiqueta-estado";
import { AppShell } from "@/components/app-shell";

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

  const cuentaIdPermitida = await obtenerCuentaIdPermitida();
  // Un colaborador restringido no elige por URL: siempre ve solo su Cuenta.
  const cuentaId = cuentaIdPermitida ?? (cuentaFiltro || undefined);

  const cuentas = await prisma.cuenta.findMany({
    where: cuentaIdPermitida ? { id: cuentaIdPermitida } : undefined,
    orderBy: { nombre: "asc" },
  });

  const publicaciones = await prisma.publicacion.findMany({
    where: {
      ...(cuentaId ? { cuentaId } : {}),
      ...(estadoFiltro ? { estado: estadoFiltro } : {}),
    },
    orderBy: { creadaEn: "desc" },
    take: 100,
    include: { cuenta: true, _count: { select: { archivos: true } } },
  });

  return (
    <AppShell active="historial">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Historial</h1>
        <a href="/publicar" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
          Publicar →
        </a>
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
              className="flex flex-col gap-1 rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm"
            >
              <PublicacionResumen publicacion={publicacion} mostrarFecha />
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
