import { createClient } from "@/lib/supabase/server";
import { Sidebar, type Seccion } from "@/components/sidebar";

/** Sidebar + contenido compartidos por las páginas autenticadas, con la sección activa resaltada. */
export async function AppShell({
  active,
  children,
}: {
  active: Seccion;
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar active={active} email={user?.email ?? null} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-8 sm:px-8">
        {children}
      </main>
    </div>
  );
}
