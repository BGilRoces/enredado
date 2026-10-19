import { createClient } from "@/lib/supabase/server";
import { NavegacionMovil, Sidebar, type Seccion } from "@/components/sidebar";

/**
 * Navegación + contenido compartidos por las páginas autenticadas, con la
 * sección activa resaltada: sidebar en desktop, barra arriba + pestañas abajo
 * en celu (el padding inferior del main deja lugar a esas pestañas).
 */
export async function AppShell({
  active,
  // "completo" es para pantallas con layout de columnas (ej. calendario +
  // ideas) o listados anchos (ej. ideas) que necesitan más aire que el
  // max-w-2xl de un formulario.
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
    <div className="flex min-h-screen w-full flex-col md:flex-row">
      <Sidebar active={active} email={user?.email ?? null} />
      <NavegacionMovil active={active} />
      <main
        className={`mx-auto flex w-full min-w-0 flex-1 flex-col gap-6 px-3 pt-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 md:gap-8 md:px-8 md:py-8 ${
          ancho === "completo" ? "max-w-6xl" : "max-w-2xl"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
