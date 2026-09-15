import { EstadoCuenta } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { obtenerCuentaIdPermitida } from "@/lib/auth/cuenta-permitida";
import { AppShell } from "@/components/app-shell";

const ACCESOS = [
  {
    href: "/cuentas",
    titulo: "Cuentas",
    descripcion: "Conectá o revisá el estado de tus Instagrams.",
  },
  {
    href: "/publicar",
    titulo: "Publicar",
    descripcion: "Elegí fotos de Drive y subilas como post o historia.",
  },
  {
    href: "/historial",
    titulo: "Historial",
    descripcion: "Mirá qué se publicó y qué falló.",
  },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const cuentaIdPermitida = await obtenerCuentaIdPermitida();
  const cuentasConectadas = await prisma.cuenta.count({
    where: { estado: EstadoCuenta.conectada, ...(cuentaIdPermitida ? { id: cuentaIdPermitida } : {}) },
  });

  return (
    <AppShell active="inicio">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Hola de nuevo
        </h1>
        <p className="text-sm text-zinc-500">Sesión de {user?.email}</p>
      </div>

      <div className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <span className="bg-gradient-to-br from-indigo-600 to-fuchsia-500 bg-clip-text text-4xl font-bold text-transparent">
          {cuentasConectadas}
        </span>
        <p className="text-sm text-zinc-500">
          Cuenta{cuentasConectadas === 1 ? "" : "s"} de Instagram conectada
          {cuentasConectadas === 1 ? "" : "s"}.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {ACCESOS.map((acceso) => (
          <a
            key={acceso.href}
            href={acceso.href}
            className="flex flex-col gap-1 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
          >
            <span className="font-medium text-zinc-900">{acceso.titulo}</span>
            <span className="text-sm text-zinc-500">{acceso.descripcion}</span>
          </a>
        ))}
      </div>
    </AppShell>
  );
}
