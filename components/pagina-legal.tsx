import type { ReactNode } from "react";

/** Contenedor de las páginas públicas (sin login) que Google pide para la pantalla de consentimiento OAuth. */
export function PaginaLegal({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6 text-sm leading-6 text-zinc-700">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-900">{titulo}</h1>
      {children}
      <nav className="mt-6 flex gap-4 border-t border-zinc-200 pt-4 text-indigo-600">
        <a href="/acerca">Acerca de</a>
        <a href="/privacidad">Política de privacidad</a>
        <a href="/terminos">Condiciones del servicio</a>
      </nav>
    </main>
  );
}
