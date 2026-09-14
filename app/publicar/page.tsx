import { EstadoCuenta } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { PublicarForm } from "./publicar-form";

// Sin esto, Next intenta prerenderizar la página en build time (no hay
// DATABASE_URL disponible ahí) — la lista de Cuentas/Publicaciones necesita
// ser siempre fresca de todos modos, así que nunca debería cachearse.
export const dynamic = "force-dynamic";

export default async function PublicarPage() {
  const cuentas = await prisma.cuenta.findMany({
    where: { estado: EstadoCuenta.conectada },
    orderBy: { nombre: "asc" },
  });

  const publicaciones = await prisma.publicacion.findMany({
    orderBy: { creadaEn: "desc" },
    take: 10,
    include: { cuenta: true },
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 p-8">
      <h1 className="text-xl font-semibold">Publicar un Post</h1>

      {cuentas.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No hay Cuentas conectadas.{" "}
          <a href="/cuentas" className="underline">
            Conectá una
          </a>{" "}
          primero.
        </p>
      ) : (
        <PublicarForm
          cuentas={cuentas.map((cuenta) => ({
            id: cuenta.id,
            nombre: cuenta.nombre,
            igUsername: cuenta.igUsername,
          }))}
        />
      )}

      {publicaciones.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-zinc-700">Últimas Publicaciones</h2>
          <ul className="flex flex-col gap-2">
            {publicaciones.map((publicacion) => (
              <li
                key={publicacion.id}
                className="rounded border border-zinc-200 p-3 text-sm"
              >
                <span className="font-medium">{publicacion.cuenta.nombre}</span> ·{" "}
                {publicacion.estado}
                {publicacion.error && (
                  <p className="text-red-700">{publicacion.error}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
