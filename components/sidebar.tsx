"use client";

import Link from "next/link";
import { useState } from "react";
import { cerrarSesion } from "@/lib/auth/actions";

export type Seccion = "inicio" | "cuentas" | "publicar" | "historial" | "ideas" | "calendario" | "configuracion";

const NAV: { href: string; label: string; seccion: Seccion; icon: (props: { className?: string }) => React.ReactNode }[] = [
  { href: "/", label: "Inicio", seccion: "inicio", icon: IconInicio },
  { href: "/cuentas", label: "Cuentas", seccion: "cuentas", icon: IconCuentas },
  { href: "/publicar", label: "Publicar", seccion: "publicar", icon: IconPublicar },
  { href: "/ideas", label: "Ideas", seccion: "ideas", icon: IconIdeas },
  { href: "/ideas/calendario", label: "Calendario", seccion: "calendario", icon: IconCalendario },
  { href: "/historial", label: "Historial", seccion: "historial", icon: IconHistorial },
];

/** Sidebar colapsable con navegación, compartida por las páginas autenticadas. */
export function Sidebar({ active, email }: { active: Seccion; email: string | null }) {
  const [colapsado, setColapsado] = useState(false);

  return (
    <aside
      className={
        "sticky top-0 flex h-screen shrink-0 flex-col border-r border-zinc-200 bg-white transition-[width] duration-200 " +
        (colapsado ? "w-16" : "w-56")
      }
    >
      <div className="flex items-center justify-between gap-2 px-4 py-4">
        {!colapsado && (
          <Link
            href="/"
            className="bg-gradient-to-r from-indigo-600 to-fuchsia-500 bg-clip-text text-lg font-bold tracking-tight text-transparent"
          >
            enredado
          </Link>
        )}
        <button
          type="button"
          onClick={() => setColapsado((valor) => !valor)}
          className="ml-auto shrink-0 rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          aria-label={colapsado ? "Expandir menú" : "Colapsar menú"}
        >
          <IconChevron className={"h-4 w-4 transition-transform " + (colapsado ? "rotate-180" : "")} />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-2 text-sm">
        {NAV.map((item) => (
          <a
            key={item.href}
            href={item.href}
            title={colapsado ? item.label : undefined}
            className={
              "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors " +
              (colapsado ? "justify-center" : "") +
              " " +
              (item.seccion === active
                ? "bg-indigo-50 font-medium text-indigo-700"
                : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900")
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!colapsado && item.label}
          </a>
        ))}
      </nav>

      <div className="border-t border-zinc-200 px-2 py-3">
        {!colapsado && email && (
          <p className="truncate px-3 pb-2 text-xs text-zinc-400" title={email}>
            {email}
          </p>
        )}
        <form action={cerrarSesion}>
          <button
            type="submit"
            title={colapsado ? "Cerrar sesión" : undefined}
            className={
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 " +
              (colapsado ? "justify-center" : "")
            }
          >
            <IconCerrarSesion className="h-5 w-5 shrink-0" />
            {!colapsado && "Cerrar sesión"}
          </button>
        </form>
      </div>
    </aside>
  );
}

function IconInicio({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9h12v-9" />
      <path d="M10 19v-5h4v5" />
    </svg>
  );
}

function IconCuentas({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5" />
    </svg>
  );
}

function IconPublicar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 15V5" />
      <path d="M8 9l4-4 4 4" />
      <path d="M5 19h14" />
    </svg>
  );
}

function IconIdeas({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="10" r="5.5" />
      <path d="M9.5 18h5" />
      <path d="M10.3 20.5h3.4" />
    </svg>
  );
}

function IconCalendario({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4" y="6" width="16" height="14" rx="2" />
      <path d="M4 10h16" />
      <path d="M8 4v4" />
      <path d="M16 4v4" />
    </svg>
  );
}

function IconHistorial({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5l3.3 2" />
    </svg>
  );
}

function IconCerrarSesion({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
      <path d="M13 16l4-4-4-4" />
      <path d="M17 12H8" />
    </svg>
  );
}

function IconChevron({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}
