import Link from "next/link";
import { cerrarSesion } from "@/lib/auth/actions";

type Seccion = "inicio" | "cuentas" | "publicar" | "historial" | "ideas" | "configuracion";

const NAV: { href: string; label: string; seccion: Seccion }[] = [
  { href: "/", label: "Inicio", seccion: "inicio" },
  { href: "/cuentas", label: "Cuentas", seccion: "cuentas" },
  { href: "/publicar", label: "Publicar", seccion: "publicar" },
  { href: "/ideas", label: "Ideas", seccion: "ideas" },
  { href: "/historial", label: "Historial", seccion: "historial" },
];

/** Header + nav compartidos por las páginas autenticadas, con la sección activa resaltada. */
export function AppShell({
  active,
  children,
}: {
  active: Seccion;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4 sm:px-8">
          <Link
            href="/"
            className="bg-gradient-to-r from-indigo-600 to-fuchsia-500 bg-clip-text text-lg font-bold tracking-tight text-transparent"
          >
            enredado
          </Link>
          <div className="flex items-center gap-2">
            <nav className="flex gap-1 text-sm">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className={
                    item.seccion === active
                      ? "rounded-full bg-indigo-50 px-3 py-1.5 font-medium text-indigo-700"
                      : "rounded-full px-3 py-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                  }
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <form action={cerrarSesion}>
              <button
                type="submit"
                className="rounded-full px-3 py-1.5 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-8 sm:px-8">
        {children}
      </div>
    </>
  );
}
