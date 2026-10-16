import type { Prisma } from "@prisma/client";

/**
 * Una Idea pertenece a una Cuenta principal (`cuenta`) y puede tener más
 * Cuentas colaboradoras (`colaboradoras`): un contenido en colab que aparece
 * en las dos. Estos helpers concentran qué significa "la Idea es de la Cuenta X".
 */

/**
 * `null` = sin filtro. Usa `AND` para no pisar el `OR` de whereProducto al
 * combinarse con él en el mismo `where`.
 */
export function whereCuentasIdea(cuentaIds: string[] | null): Prisma.IdeaWhereInput {
  if (cuentaIds === null) return {};
  return {
    AND: [{ OR: [{ cuentaId: { in: cuentaIds } }, { colaboradoras: { some: { id: { in: cuentaIds } } } }] }],
  };
}

/** "MIMADA + Biashop": la Cuenta principal primero, después las colaboradoras. */
export function nombresCuentasIdea(idea: { cuenta: { nombre: string }; colaboradoras?: { nombre: string }[] }): string {
  return [idea.cuenta.nombre, ...(idea.colaboradoras ?? []).map((c) => c.nombre)].join(" + ");
}
