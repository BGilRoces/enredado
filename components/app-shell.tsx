import { createClient } from "@/lib/supabase/server";
import { Sidebar, type Seccion } from "@/components/sidebar";

/** Sidebar + contenido compartidos por las páginas autenticadas, con la sección activa resaltada. */
export async function AppShell({
  active,
  // "completo" es para pantallas con layout de columnas (ej. calendario +
  // ideas) que necesitan más aire que el max-w-2xl de un formulario/listado.
  ancho = "normal",
  children,
}: {
  active: Seccion;
  ancho?: "normal" | "completo";
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar active={active} email={user?.email ?? null} />
      <main
        className={`mx-auto flex w-full flex-1 flex-col gap-8 px-6 py-8 sm:px-8 ${
          ancho === "completo" ? "max-w-6xl" : "max-w-2xl"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
