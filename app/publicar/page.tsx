import { EstadoCuenta, EstadoPublicacion } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { obtenerCuentaIdPermitida } from "@/lib/auth/cuenta-permitida";
import { PublicarForm } from "./publicar-form";
import { FiltroCheckboxes } from "@/components/filtro-checkboxes";
import { parsearSeleccionMultiple } from "@/lib/parsear-seleccion-multiple";
import { PublicacionResumen } from "@/components/publicacion-resumen";
import { PublicacionFilaExpandible } from "@/components/publicacion-fila-expandible";
import { AppShell } from "@/components/app-shell";

// Sin esto, Next intenta prerenderizar la página en build time (no hay
// DATABASE_URL disponible ahí) — la lista de Cuentas/Publicaciones necesita
// ser siempre fresca de todos modos, así que nunca debería cachearse.
export const dynamic = "force-dynamic";

export default async function PublicarPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  const cuentaIdPermitida = await obtenerCuentaIdPermitida();

  const cuentas = await prisma.cuenta.findMany({
    where: { estado: EstadoCuenta.conectada, ...(cuentaIdPermitida ? { id: cuentaIdPermitida } : {}) },
    orderBy: { nombre: "asc" },
  });

  const cuentasFiltro = parsearSeleccionMultiple(
    params.cuentaId,
    cuentas.map((cuenta) => cuenta.id),
  );

  const pendientes = await prisma.publicacion.findMany({
    where: {
      estado: { in: [EstadoPublicacion.pendiente, EstadoPublicacion.publicando] },
      // Un colaborador restringido no elige por URL: siempre ve solo su Cuenta.
      ...(cuentaIdPermitida
        ? { cuentaId: cuentaIdPermitida }
        : cuentasFiltro
          ? { cuentaId: { in: cuentasFiltro } }
          : {}),
    },
    orderBy: { creadaEn: "asc" },
    include: { cuenta: true, _count: { select: { archivos: true } } },
  });

  const publicaciones = await prisma.publicacion.findMany({
    where: {
      estado: {
        in: [
          EstadoPublicacion.publicada,
          EstadoPublicacion.fallida,
          EstadoPublicacion.bloqueadaPorLimite,
          EstadoPublicacion.cancelada,
        ],
      },
      ...(cuentaIdPermitida ? { cuentaId: cuentaIdPermitida } : {}),
    },
    orderBy: { creadaEn: "desc" },
    take: 10,
    include: {
      cuenta: true,
      archivos: { orderBy: { orden: "asc" } },
      _count: { select: { archivos: true } },
    },
  });

  return (
    <AppShell active="publicar">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Publicar</h1>

      {cuentas.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No hay Cuentas conectadas.{" "}
          <a href="/cuentas" className="font-medium text-indigo-600 hover:text-indigo-700">
            Conectá una
          </a>{" "}
          primero.
        </p>
      ) : (
        <PublicarForm
          cuentas={cuentas.map((cuenta) => ({
            id: cuenta.id,
            nombre: cuenta.nombre,
            igUsername: cuenta.igUsername,
          }))}
        />
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-700">Pendientes</h2>
          <FiltroCheckboxes
            name="cuentaId"
            etiqueta="Cuenta:"
            opciones={cuentas.map((cuenta) => ({ value: cuenta.id, label: cuenta.nombre }))}
            seleccionadas={cuentasFiltro}
          />
        </div>

        {pendientes.length === 0 ? (
          <p className="text-sm text-zinc-500">No hay Publicaciones pendientes.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pendientes.map((publicacion) => (
              <li
                key={publicacion.id}
                className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm"
              >
                <PublicacionResumen publicacion={publicacion} mostrarFecha />

                {publicacion.ideaId && (
                  <a
                    href={`/ideas/${publicacion.ideaId}`}
                    className="self-start text-xs font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    Editar, reprogramar o cancelar →
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {publicaciones.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-zinc-700">Últimas Publicaciones</h2>
          <ul className="flex max-h-[220px] flex-col gap-2 overflow-y-auto pr-1">
            {publicaciones.map((publicacion) => (
              <PublicacionFilaExpandible key={publicacion.id} publicacion={publicacion} />
            ))}
          </ul>
        </div>
      )}
    </AppShell>
  );
}
