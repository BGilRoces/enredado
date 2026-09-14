import { EstadoCuenta } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const cuentasConectadas = await prisma.cuenta.count({
    where: { estado: EstadoCuenta.conectada },
  });

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8">
      <h1 className="text-xl font-semibold">enredado</h1>
      <p className="text-sm text-zinc-500">
        Sesión de {user?.email} — {cuentasConectadas} Cuenta(s) de Instagram
        conectada(s).
      </p>
      <a href="/cuentas" className="text-sm underline">
        Gestionar Cuentas
      </a>
    </div>
  );
}
