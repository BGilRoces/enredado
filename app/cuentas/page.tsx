import { EstadoCuenta, EstadoPublicacion, type Cuenta } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { obtenerCuentaIdPermitida } from "@/lib/auth/cuenta-permitida";
import { crearCuentaManual, desconectarCuenta } from "./actions";
import { LIMITE_PUBLICACIONES_POR_VENTANA, VENTANA_LIMITE_MS } from "@/lib/limite-diario/excedio-limite-diario";
import { AppShell } from "@/components/app-shell";
import { EliminarCuentaBoton } from "@/components/eliminar-cuenta-boton";
import { ProductosCuenta } from "@/components/productos-cuenta";
import { SubmitButton } from "@/components/submit-button";

const ETIQUETA_ESTADO_CUENTA: Record<EstadoCuenta, string> = {
  conectada: "Conectada",
  desconectada: "Desconectada",
  necesitaReconexion: "Necesita reconexión",
};

const BADGE_ESTADO_CUENTA: Record<EstadoCuenta, string> = {
  conectada: "bg-emerald-100 text-emerald-700",
  desconectada: "bg-zinc-100 text-zinc-500",
  necesitaReconexion: "bg-rose-100 text-rose-700",
};

/** Alta manual (sin OAuth): conectada pero sin token de Meta. */
function esManual(cuenta: Cuenta): boolean {
  return cuenta.estado === EstadoCuenta.conectada && !cuenta.accessTokenEncriptado;
}

/** Función aparte (no en el cuerpo del Server Component) para no llamar Date.now() en el render. */
async function contarPublicadasHoyPorCuenta(cuentas: Cuenta[]): Promise<Map<string, number>> {
  const desdeVentana = new Date(Date.now() - VENTANA_LIMITE_MS);
  return new Map(
    await Promise.all(
      cuentas
        .filter((cuenta) => cuenta.estado === EstadoCuenta.conectada && !esManual(cuenta))
        .map(
          async (cuenta) =>
            [
              cuenta.id,
              await prisma.publicacion.count({
                where: {
                  cuentaId: cuenta.id,
                  estado: EstadoPublicacion.publicada,
                  publicadaEn: { gt: desdeVentana },
                },
              }),
            ] as const
        )
    )
  );
}

export default async function CuentasPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const connected = params.connected;
  const error = typeof params.error === "string" ? params.error : null;

  const cuentaIdPermitida = await obtenerCuentaIdPermitida();
  const cuentas = await prisma.cuenta.findMany({
    where: cuentaIdPermitida ? { id: cuentaIdPermitida } : undefined,
    orderBy: { creadaEn: "asc" },
    include: { productos: { orderBy: { nombre: "asc" }, select: { id: true, nombre: true } } },
  });
  const publicadasHoyPorCuenta = await contarPublicadasHoyPorCuenta(cuentas);

  return (
    <AppShell active="cuentas">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          Cuentas de Instagram
        </h1>
        {!cuentaIdPermitida && (
          <div className="flex items-center gap-3">
            <a href="/configuracion" className="hidden text-sm font-medium text-indigo-600 hover:text-indigo-700 sm:inline">
              Configuración
            </a>
            <a
              href="/api/meta/connect"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              Conectar con Instagram
            </a>
          </div>
        )}
      </div>

      {!cuentaIdPermitida && (
        <form action={crearCuentaManual} className="flex flex-col gap-2 rounded-2xl sm:flex-row sm:flex-wrap sm:items-end border border-zinc-200 bg-white p-4 shadow-sm">
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
            Nombre
            <input
              name="nombre"
              required
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-normal text-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
            Usuario de IG (opcional)
            <input
              name="igUsername"
              placeholder="@usuario"
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-normal text-zinc-900"
            />
          </label>
          <SubmitButton
            pendingText="Agregando…"
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
          >
            Agregar cuenta
          </SubmitButton>
        </form>
      )}

      {connected && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          Se conectaron {connected} Cuenta(s) de Instagram.
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>
      )}

      {cuentas.length === 0 ? (
        <p className="text-sm text-zinc-500">Todavía no hay Cuentas.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {cuentas.map((cuenta) => (
            <li
              key={cuenta.id}
              className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-fuchsia-500 text-sm font-semibold text-white">
                  {cuenta.nombre.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="break-words font-medium text-zinc-900">{cuenta.nombre}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-zinc-500">@{cuenta.igUsername}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_ESTADO_CUENTA[cuenta.estado]}`}
                    >
                      {esManual(cuenta) ? "Manual" : ETIQUETA_ESTADO_CUENTA[cuenta.estado]}
                    </span>
                    {cuenta.estado === EstadoCuenta.conectada && !esManual(cuenta) && (
                      <span className="text-xs text-zinc-400">
                        {publicadasHoyPorCuenta.get(cuenta.id) ?? 0}/
                        {LIMITE_PUBLICACIONES_POR_VENTANA} publicadas (últimas 24hs)
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {esManual(cuenta) && <EliminarCuentaBoton id={cuenta.id} nombre={cuenta.nombre} />}
              {cuenta.estado === EstadoCuenta.conectada && !esManual(cuenta) && (
                <form
                  action={async () => {
                    "use server";
                    await desconectarCuenta(cuenta.id);
                  }}
                >
                  <SubmitButton
                    pendingText="Desconectando…"
                    className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm text-rose-700 transition-colors hover:bg-rose-50"
                  >
                    Desconectar
                  </SubmitButton>
                </form>
              )}
              {cuenta.estado === EstadoCuenta.necesitaReconexion && (
                <a
                  href="/api/meta/connect"
                  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
                >
                  Reconectar
                </a>
              )}
              {cuenta.estado === EstadoCuenta.desconectada && (
                <EliminarCuentaBoton id={cuenta.id} nombre={cuenta.nombre} />
              )}
              </div>
              <ProductosCuenta cuentaId={cuenta.id} productos={cuenta.productos} />
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
