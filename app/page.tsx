import { EstadoCuenta, EstadoIdea, EstadoPublicacion } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { nombresCuentasIdea, whereCuentasIdea } from "@/lib/ideas/cuentas-de-idea";
import { formatearFechaHora } from "@/lib/zona-horaria";
import { obtenerCuentaIdPermitida } from "@/lib/auth/cuenta-permitida";
import { AppShell } from "@/components/app-shell";
import { PublicacionResumen } from "@/components/publicacion-resumen";
import { DescartarAlertaBoton } from "@/components/descartar-alerta-boton";
import { descartarAlertaCuenta, descartarAlertaPublicacion } from "@/app/actions";

// Igual que /publicar y /historial: siempre fresco, no cacheable en build time.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const cuentaIdPermitida = await obtenerCuentaIdPermitida();
  const filtroCuenta = cuentaIdPermitida ? { cuentaId: cuentaIdPermitida } : {};

  const totalCuentas = await prisma.cuenta.count({
    where: cuentaIdPermitida ? { id: cuentaIdPermitida } : undefined,
  });

  const cuentasNecesitanReconexion = await prisma.cuenta.findMany({
    where: {
      estado: EstadoCuenta.necesitaReconexion,
      alertaDescartada: false,
      ...(cuentaIdPermitida ? { id: cuentaIdPermitida } : {}),
    },
    orderBy: { nombre: "asc" },
  });

  const publicacionesFallidas = await prisma.publicacion.findMany({
    where: { estado: EstadoPublicacion.fallida, alertaDescartada: false, ...filtroCuenta },
    orderBy: { actualizadaEn: "desc" },
    take: 50,
    include: { cuenta: true, _count: { select: { archivos: true } } },
  });

  // El panel no publica solo (ver ADR-0020): lo que importa es qué falta programar en la app de IG.
  const faltaProgramar = await prisma.idea.findMany({
    where: {
      estado: EstadoIdea.enDrive,
      programadaPara: { not: null },
      programadaEnIgEl: null,
      publicadaEl: null,
      ...whereCuentasIdea(cuentaIdPermitida ? [cuentaIdPermitida] : null),
    },
    orderBy: { programadaPara: "asc" },
    take: 10,
    include: { cuenta: true, colaboradoras: true },
  });

  const actividadReciente = await prisma.publicacion.findMany({
    where: { estado: EstadoPublicacion.publicada, ...filtroCuenta },
    orderBy: { publicadaEn: "desc" },
    take: 5,
    include: { cuenta: true, _count: { select: { archivos: true } } },
  });

  const hayAlertas = cuentasNecesitanReconexion.length > 0 || publicacionesFallidas.length > 0;

  return (
    <AppShell active="inicio">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Hola de nuevo
        </h1>
        <p className="text-sm text-zinc-500">Sesión de {user?.email}</p>
      </div>

      {totalCuentas === 0 ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="font-medium text-zinc-900">Todavía no hay Cuentas conectadas.</p>
          <p className="text-sm text-zinc-500">
            Conectá tu primer Instagram para empezar a organizar su contenido.
          </p>
          <a
            href="/cuentas"
            className="mt-1 w-fit rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
          >
            Conectar cuenta
          </a>
        </div>
      ) : (
        <>
          {hayAlertas && (
            <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <h2 className="text-sm font-semibold text-rose-900">Necesita atención</h2>
              {cuentasNecesitanReconexion.map((cuenta) => (
                <div key={cuenta.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-rose-700">
                    {cuenta.nombre} (@{cuenta.igUsername}) necesita reconexión.
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <a href="/cuentas" className="font-medium text-rose-900 hover:underline">
                      Reconectar →
                    </a>
                    <DescartarAlertaBoton onDescartar={descartarAlertaCuenta.bind(null, cuenta.id)} />
                  </div>
                </div>
              ))}
              {publicacionesFallidas.length > 0 && (
                <div
                  className={`flex max-h-[272px] flex-col gap-3 overflow-y-auto pr-1 ${
                    cuentasNecesitanReconexion.length > 0 ? "border-t border-rose-200 pt-3" : ""
                  }`}
                >
                  {publicacionesFallidas.map((publicacion) => (
                    <div
                      key={publicacion.id}
                      className="flex items-start justify-between gap-2 border-t border-rose-200 pt-3 text-sm first:border-t-0 first:pt-0"
                    >
                      <div className="flex flex-1 flex-col gap-1">
                        <PublicacionResumen publicacion={publicacion} mostrarFecha />
                      </div>
                      <DescartarAlertaBoton
                        onDescartar={descartarAlertaPublicacion.bind(null, publicacion.id)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-zinc-900">Falta programar en Instagram</h2>
            {faltaProgramar.length === 0 ? (
              <p className="text-sm text-zinc-500">No hay nada pendiente de programar en la app.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {faltaProgramar.map((idea) => (
                  <li key={idea.id}>
                    <a
                      href={`/ideas/${idea.id}`}
                      className="flex flex-col gap-1 rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm transition-colors hover:bg-zinc-50"
                    >
                      <span className="font-medium text-zinc-900">{idea.titulo}</span>
                      <span className="text-xs text-zinc-500">
                        {nombresCuentasIdea(idea)} · {idea.tipo} · {formatearFechaHora(idea.programadaPara!)}
                        {idea.audio ? ` · Audio: ${idea.audio}` : ""}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-zinc-900">Actividad reciente</h2>
            {actividadReciente.length === 0 ? (
              <p className="text-sm text-zinc-500">Todavía no se publicó nada.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {actividadReciente.map((publicacion) => (
                  <li
                    key={publicacion.id}
                    className="flex flex-col gap-1 rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm"
                  >
                    <PublicacionResumen publicacion={publicacion} mostrarFecha />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}
