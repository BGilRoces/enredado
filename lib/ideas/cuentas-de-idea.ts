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

/**
 * "Publicada" = la marcó el dueño (`publicadaEl`) o la publicó el panel antes
 * de ADR-0020 (tiene una Publicación `publicada`). /ideas muestra sólo las
 * que no lo están, o sólo las que sí con `soloPublicadas`.
 */
export function wherePublicadaIdea(soloPublicadas: boolean): Prisma.IdeaWhereInput {
  const publicadaPorPanel: Prisma.IdeaWhereInput = { publicaciones: { some: { estado: "publicada" } } };
  return soloPublicadas
    ? { OR: [{ publicadaEl: { not: null } }, publicadaPorPanel] }
    : { publicadaEl: null, NOT: publicadaPorPanel };
}
