import { EstadoCuenta, EstadoPublicacion, type Cuenta } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { desconectarCuenta } from "./actions";
import { LIMITE_PUBLICACIONES_POR_VENTANA, VENTANA_LIMITE_MS } from "@/lib/limite-diario/excedio-limite-diario";
import { AppShell } from "@/components/app-shell";

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

/** Función aparte (no en el cuerpo del Server Component) para no llamar Date.now() en el render. */
async function contarPublicadasHoyPorCuenta(cuentas: Cuenta[]): Promise<Map<string, number>> {
  const desdeVentana = new Date(Date.now() - VENTANA_LIMITE_MS);
  return new Map(
    await Promise.all(
      cuentas
        .filter((cuenta) => cuenta.estado === EstadoCuenta.conectada)
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

  const cuentas = await prisma.cuenta.findMany({ orderBy: { creadaEn: "asc" } });
  const publicadasHoyPorCuenta = await contarPublicadasHoyPorCuenta(cuentas);

  return (
    <AppShell active="cuentas">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          Cuentas de Instagram
        </h1>
        <a
          href="/api/meta/connect"
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
        >
          Conectar cuenta
        </a>
      </div>

      {connected && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          Se conectaron {connected} Cuenta(s) de Instagram.
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>
      )}

      {cuentas.length === 0 ? (
        <p className="text-sm text-zinc-500">Todavía no hay Cuentas conectadas.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {cuentas.map((cuenta) => (
            <li
              key={cuenta.id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-fuchsia-500 text-sm font-semibold text-white">
                  {cuenta.nombre.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <p className="font-medium text-zinc-900">{cuenta.nombre}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-zinc-500">@{cuenta.igUsername}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_ESTADO_CUENTA[cuenta.estado]}`}
                    >
                      {ETIQUETA_ESTADO_CUENTA[cuenta.estado]}
                    </span>
                    {cuenta.estado === EstadoCuenta.conectada && (
                      <span className="text-xs text-zinc-400">
                        {publicadasHoyPorCuenta.get(cuenta.id) ?? 0}/
                        {LIMITE_PUBLICACIONES_POR_VENTANA} publicadas (últimas 24hs)
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {cuenta.estado === EstadoCuenta.conectada && (
                <form
                  action={async () => {
                    "use server";
                    await desconectarCuenta(cuenta.id);
                  }}
                >
                  <button
                    type="submit"
                    className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm text-rose-700 transition-colors hover:bg-rose-50"
                  >
                    Desconectar
                  </button>
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
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
