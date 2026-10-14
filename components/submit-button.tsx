"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";

/**
 * <button type="submit"> con feedback de "guardando" para los <form action={...}>
 * de Server Actions: como esas páginas son Server Components sin JS de cliente
 * (ver comentario en app/ideas/[id]/page.tsx), useFormStatus es la única forma
 * de saber si el form padre está en vuelo sin convertir la página entera en
 * client component.
 */
export function SubmitButton({
  children,
  pendingText,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} aria-busy={pending} {...props}>
      {pending ? (
        <span className="inline-flex items-center gap-1.5">
          <Spinner />
          {pendingText ?? children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
