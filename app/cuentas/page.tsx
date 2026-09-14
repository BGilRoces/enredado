import { EstadoCuenta, EstadoPublicacion, type Cuenta } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { desconectarCuenta } from "./actions";
import { LIMITE_PUBLICACIONES_POR_VENTANA, VENTANA_LIMITE_MS } from "@/lib/limite-diario/excedio-limite-diario";

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
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Cuentas de Instagram</h1>
        <a
          href="/api/meta/connect"
          className="rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
        >
          Conectar cuenta
        </a>
      </div>

      {connected && (
        <p className="rounded bg-green-50 p-3 text-sm text-green-700">
          Se conectaron {connected} Cuenta(s) de Instagram.
        </p>
      )}
      {error && (
        <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {cuentas.length === 0 ? (
        <p className="text-sm text-zinc-500">Todavía no hay Cuentas conectadas.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {cuentas.map((cuenta) => (
            <li
              key={cuenta.id}
              className="flex items-center justify-between rounded border border-zinc-200 p-3"
            >
              <div>
                <p className="font-medium">{cuenta.nombre}</p>
                <p
                  className={
                    cuenta.estado === EstadoCuenta.necesitaReconexion
                      ? "text-sm text-red-700"
                      : "text-sm text-zinc-500"
                  }
                >
                  @{cuenta.igUsername} ·{" "}
                  {cuenta.estado === EstadoCuenta.necesitaReconexion
                    ? "necesita reconexión"
                    : cuenta.estado}
                  {cuenta.estado === EstadoCuenta.conectada &&
                    ` · ${publicadasHoyPorCuenta.get(cuenta.id) ?? 0}/${LIMITE_PUBLICACIONES_POR_VENTANA} publicadas (últimas 24hs)`}
                </p>
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
                    className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700"
                  >
                    Desconectar
                  </button>
                </form>
              )}
              {cuenta.estado === EstadoCuenta.necesitaReconexion && (
                <a
                  href="/api/meta/connect"
                  className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white"
                >
                  Reconectar
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
