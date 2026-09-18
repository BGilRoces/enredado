import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { obtenerCuentaIdPermitida } from "@/lib/auth/cuenta-permitida";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

/**
 * El acceso a Drive del lado del servidor (ver ADR-0014) es un recurso
 * global del panel, no por Cuenta de Instagram — un Colaborador restringido
 * a una Cuenta no debe poder reconectarlo ni ver el estado de esta pantalla.
 */
export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const cuentaIdPermitida = await obtenerCuentaIdPermitida();
  if (cuentaIdPermitida) redirect("/");

  const params = await searchParams;
  const connected = params.connected;
  const error = typeof params.error === "string" ? params.error : null;

  const credencial = await prisma.driveCredencial.findUnique({ where: { slot: "default" } });

  return (
    <AppShell active="configuracion">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Configuración</h1>

      {connected && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          Google Drive conectado.
        </p>
      )}
      {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <div className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="font-medium text-zinc-900">Google Drive</p>
        <p className="text-sm text-zinc-500">
          Necesario para que las Ideas calendarizadas se publiquen solas, sin tener el navegador
          abierto en el momento (ver ADR-0014). Distinto del selector de Drive de /publicar.
        </p>
        {credencial ? (
          <p className="text-sm text-zinc-700">
            Conectado como <span className="font-medium">{credencial.cuentaGoogleEmail}</span>
          </p>
        ) : (
          <p className="text-sm text-zinc-500">Todavía no conectado.</p>
        )}
        <a
          href="/api/drive/connect"
          className="mt-1 w-fit rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
        >
          {credencial ? "Reconectar" : "Conectar"} Google Drive
        </a>
      </div>
    </AppShell>
  );
}
