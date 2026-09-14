import { EstadoCuenta, EstadoPublicacion } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { PublicarForm } from "./publicar-form";
import { cancelarPublicacion, editarPublicacion } from "./actions";
import { CuentaFiltroForm } from "@/components/cuenta-filtro-form";
import { PublicacionResumen } from "@/components/publicacion-resumen";

// Sin esto, Next intenta prerenderizar la página en build time (no hay
// DATABASE_URL disponible ahí) — la lista de Cuentas/Publicaciones necesita
// ser siempre fresca de todos modos, así que nunca debería cachearse.
export const dynamic = "force-dynamic";

function aInputDatetimeLocal(fecha: Date | null): string {
  return fecha ? fecha.toISOString().slice(0, 16) : "";
}

export default async function PublicarPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const cuentaFiltro = typeof params.cuentaId === "string" ? params.cuentaId : "";

  const cuentas = await prisma.cuenta.findMany({
    where: { estado: EstadoCuenta.conectada },
    orderBy: { nombre: "asc" },
  });

  const pendientes = await prisma.publicacion.findMany({
    where: {
      estado: { in: [EstadoPublicacion.pendiente, EstadoPublicacion.publicando] },
      ...(cuentaFiltro ? { cuentaId: cuentaFiltro } : {}),
    },
    orderBy: { creadaEn: "asc" },
    include: { cuenta: true },
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
    },
    orderBy: { creadaEn: "desc" },
    take: 10,
    include: { cuenta: true },
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Publicar</h1>
        <a href="/historial" className="text-sm underline">
          Ver historial completo
        </a>
      </div>

      {cuentas.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No hay Cuentas conectadas.{" "}
          <a href="/cuentas" className="underline">
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
          <CuentaFiltroForm cuentas={cuentas} cuentaSeleccionada={cuentaFiltro} />
        </div>

        {pendientes.length === 0 ? (
          <p className="text-sm text-zinc-500">No hay Publicaciones pendientes.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pendientes.map((publicacion) => (
              <li
                key={publicacion.id}
                className="flex flex-col gap-2 rounded border border-zinc-200 p-3 text-sm"
              >
                <PublicacionResumen publicacion={publicacion} mostrarFecha />

                {publicacion.estado === EstadoPublicacion.pendiente && (
                  <>
                    <form
                      action={async (formData: FormData) => {
                        "use server";
                        const caption = String(formData.get("caption") ?? "");
                        const programadaParaRaw = String(formData.get("programadaPara") ?? "");
                        await editarPublicacion(publicacion.id, {
                          caption,
                          programadaPara: programadaParaRaw ? new Date(programadaParaRaw) : null,
                        });
                      }}
                      className="flex flex-col gap-2"
                    >
                      <textarea
                        name="caption"
                        defaultValue={publicacion.caption ?? ""}
                        rows={2}
                        className="rounded border border-zinc-300 p-2 text-sm"
                      />
                      <input
                        type="datetime-local"
                        name="programadaPara"
                        defaultValue={aInputDatetimeLocal(publicacion.programadaPara)}
                        className="rounded border border-zinc-300 p-2 text-sm"
                      />
                      <span className="text-xs text-zinc-500">
                        Hora UTC. Dejá el campo vacío para pasar a &quot;ahora&quot;.
                      </span>
                      <button
                        type="submit"
                        className="self-start rounded border border-zinc-300 px-2 py-1 text-xs font-medium"
                      >
                        Guardar cambios
                      </button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await cancelarPublicacion(publicacion.id);
                      }}
                    >
                      <button
                        type="submit"
                        className="rounded border border-red-300 px-2 py-1 text-xs text-red-700"
                      >
                        Cancelar
                      </button>
                    </form>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {publicaciones.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-zinc-700">Últimas Publicaciones</h2>
          <ul className="flex flex-col gap-2">
            {publicaciones.map((publicacion) => (
              <li key={publicacion.id} className="rounded border border-zinc-200 p-3 text-sm">
                <PublicacionResumen publicacion={publicacion} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
