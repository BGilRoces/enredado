import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8">
      <h1 className="text-xl font-semibold">enredado</h1>
      <p className="text-sm text-zinc-500">
        Sesión de {user?.email} — todavía no hay Cuentas de Instagram
        conectadas.
      </p>
    </div>
  );
}
