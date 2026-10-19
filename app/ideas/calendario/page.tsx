import { prisma } from "@/lib/db/prisma";
import { nombresCuentasIdea, whereCuentasIdea } from "@/lib/ideas/cuentas-de-idea";
import { obtenerCuentaIdPermitida } from "@/lib/auth/cuenta-permitida";
import { mesEnGrilla } from "@/lib/calendario/mes-en-grilla";
import { claveDiaLocal, inicioDeDiaLocal } from "@/lib/zona-horaria";
import { FiltroCheckboxes } from "@/components/filtro-checkboxes";
import { parsearSeleccionMultiple } from "@/lib/parsear-seleccion-multiple";
import type { IdeaEnCalendario } from "@/components/calendario-mes";
import { CalendarioConPendientes } from "@/components/calendario-con-pendientes";
import { AppShell } from "@/components/app-shell";
import { SelectorMes } from "@/components/selector-mes";
import { opcionesProducto, parsearFiltroProductos, whereProducto } from "@/lib/productos/filtro";

export const dynamic = "force-dynamic";

function parsearMes(valor: string | undefined): { anio: number; mes: number } {
  const match = valor?.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    const [anio, mes] = claveDiaLocal(new Date()).split("-").map(Number);
    return { anio, mes };
  }
  return { anio: Number(match[1]), mes: Number(match[2]) };
}

function mesSiguiente(anio: number, mes: number, delta: number): { anio: number; mes: number } {
  const total = anio * 12 + (mes - 1) + delta;
  return { anio: Math.floor(total / 12), mes: (((total % 12) + 12) % 12) + 1 };
}

function claveMes(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, "0")}`;
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const { anio, mes } = parsearMes(typeof params.mes === "string" ? params.mes : undefined);

  const cuentaIdPermitida = await obtenerCuentaIdPermitida();

  const cuentas = await prisma.cuenta.findMany({
    where: cuentaIdPermitida ? { id: cuentaIdPermitida } : undefined,
    orderBy: { nombre: "asc" },
  });

  const cuentasFiltro = parsearSeleccionMultiple(
    params.cuentaId,
    cuentas.map((cuenta) => cuenta.id),
  );

  const cuentasVisibles = cuentaIdPermitida ? [cuentaIdPermitida] : (cuentasFiltro ?? cuentas.map((c) => c.id));
  const productos = await prisma.producto.findMany({
    where: { cuentaId: { in: cuentasVisibles } },
    orderBy: [{ cuenta: { nombre: "asc" } }, { nombre: "asc" }],
    include: { cuenta: { select: { nombre: true } } },
  });
  const opcionesProductos = opcionesProducto(productos);
  const productosFiltro = parsearFiltroProductos(
    params.productoId,
    opcionesProductos.map((o) => o.value),
  );

  const dias = mesEnGrilla(anio, mes);
  const desde = inicioDeDiaLocal(dias[0].fecha.toISOString().slice(0, 10));
  const hasta = new Date(inicioDeDiaLocal(dias[dias.length - 1].fecha.toISOString().slice(0, 10)).getTime() + 24 * 60 * 60 * 1000);

  const ideas = await prisma.idea.findMany({
    where: {
      programadaPara: { gte: desde, lt: hasta },
      ...whereProducto(productosFiltro),
      ...whereCuentasIdea(cuentaIdPermitida ? [cuentaIdPermitida] : cuentasFiltro),
    },
    include: { cuenta: true, colaboradoras: true, producto: true, publicaciones: { select: { estado: true, programadaPara: true } } },
  });

  const ideasPorDia: Record<string, IdeaEnCalendario[]> = {};
  for (const idea of ideas) {
    const clave = claveDiaLocal(idea.programadaPara!);
    const lista = ideasPorDia[clave] ?? [];
    lista.push({
      id: idea.id,
      titulo: idea.titulo,
      cuentaNombre: nombresCuentasIdea(idea),
      productoNombre: idea.producto?.nombre ?? null,
      tipo: idea.tipo,
      estado: idea.estado,
      programadaPara: idea.programadaPara,
      programadaEnIgEl: idea.programadaEnIgEl,
      publicadaEl: idea.publicadaEl,
      publicaciones: idea.publicaciones,
    });
    ideasPorDia[clave] = lista;
  }

  // Lista de la izquierda: ideas todavía sin fecha, para arrastrar a un día.
  const ideasPendientes = await prisma.idea.findMany({
    where: {
      programadaPara: null,
      ...whereProducto(productosFiltro),
      ...whereCuentasIdea(cuentaIdPermitida ? [cuentaIdPermitida] : cuentasFiltro),
    },
    orderBy: { creadaEn: "desc" },
    include: { cuenta: true, colaboradoras: true, producto: true, publicaciones: { select: { estado: true, programadaPara: true } } },
  });

  const ideasPendientesEnCalendario: IdeaEnCalendario[] = ideasPendientes.map((idea) => ({
    id: idea.id,
    titulo: idea.titulo,
    cuentaNombre: nombresCuentasIdea(idea),
    productoNombre: idea.producto?.nombre ?? null,
    tipo: idea.tipo,
    estado: idea.estado,
    programadaPara: idea.programadaPara,
    programadaEnIgEl: idea.programadaEnIgEl,
    publicadaEl: idea.publicadaEl,
    publicaciones: idea.publicaciones,
  }));

  const anterior = mesSiguiente(anio, mes, -1);
  const siguiente = mesSiguiente(anio, mes, 1);
  const queryCuenta =
    (cuentasFiltro !== null ? `&cuentaId=${encodeURIComponent(cuentasFiltro.join(","))}` : "") +
    (productosFiltro !== null ? `&productoId=${encodeURIComponent(productosFiltro.join(","))}` : "");

  return (
    <AppShell active="calendario" ancho="completo">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Calendario</h1>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <a
            href={`/ideas/calendario?mes=${claveMes(anterior.anio, anterior.mes)}${queryCuenta}`}
            aria-label="Mes anterior"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            ←
          </a>
          <SelectorMes anio={anio} mes={mes} />
          <a
            href={`/ideas/calendario?mes=${claveMes(siguiente.anio, siguiente.mes)}${queryCuenta}`}
            aria-label="Mes siguiente"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            →
          </a>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {cuentas.length > 1 && (
            <FiltroCheckboxes
              name="cuentaId"
              etiqueta="Cuenta:"
              opciones={cuentas.map((cuenta) => ({ value: cuenta.id, label: cuenta.nombre }))}
              seleccionadas={cuentasFiltro}
            />
          )}
          {opcionesProductos.length > 0 && (
            <FiltroCheckboxes
              name="productoId"
              etiqueta="Producto:"
              opciones={opcionesProductos}
              seleccionadas={productosFiltro}
            />
          )}
        </div>
      </div>

      <CalendarioConPendientes
        dias={dias}
        ideasPorDia={ideasPorDia}
        hoyClave={claveDiaLocal(new Date())}
        ideasPendientes={ideasPendientesEnCalendario}
      />
    </AppShell>
  );
}
