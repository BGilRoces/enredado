import { prisma } from "@/lib/db/prisma";
import { obtenerCuentaIdPermitida } from "@/lib/auth/cuenta-permitida";
import { mesEnGrilla } from "@/lib/calendario/mes-en-grilla";
import { FiltroCheckboxes, parsearSeleccionMultiple } from "@/components/filtro-checkboxes";
import { CalendarioMes, type IdeaEnCalendario } from "@/components/calendario-mes";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function parsearMes(valor: string | undefined): { anio: number; mes: number } {
  const match = valor?.match(/^(\d{4})-(\d{2})$/);
  const ahora = new Date();
  if (!match) return { anio: ahora.getUTCFullYear(), mes: ahora.getUTCMonth() + 1 };
  return { anio: Number(match[1]), mes: Number(match[2]) };
}

function mesSiguiente(anio: number, mes: number, delta: number): { anio: number; mes: number } {
  const total = anio * 12 + (mes - 1) + delta;
  return { anio: Math.floor(total / 12), mes: (((total % 12) + 12) % 12) + 1 };
}

function claveMes(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, "0")}`;
}

function claveDia(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
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

  const dias = mesEnGrilla(anio, mes);
  const desde = dias[0].fecha;
  const hasta = new Date(dias[dias.length - 1].fecha.getTime() + 24 * 60 * 60 * 1000);

  const ideas = await prisma.idea.findMany({
    where: {
      programadaPara: { gte: desde, lt: hasta },
      ...(cuentaIdPermitida
        ? { cuentaId: cuentaIdPermitida }
        : cuentasFiltro
          ? { cuentaId: { in: cuentasFiltro } }
          : {}),
    },
    include: { cuenta: true, publicaciones: { select: { estado: true, programadaPara: true } } },
  });

  const ideasPorDia = new Map<string, IdeaEnCalendario[]>();
  for (const idea of ideas) {
    const clave = claveDia(idea.programadaPara!);
    const lista = ideasPorDia.get(clave) ?? [];
    lista.push({
      id: idea.id,
      titulo: idea.titulo,
      cuentaNombre: idea.cuenta.nombre,
      estado: idea.estado,
      programadaPara: idea.programadaPara,
      publicaciones: idea.publicaciones,
    });
    ideasPorDia.set(clave, lista);
  }

  const anterior = mesSiguiente(anio, mes, -1);
  const siguiente = mesSiguiente(anio, mes, 1);
  const queryCuenta = cuentasFiltro !== null ? `&cuentaId=${encodeURIComponent(cuentasFiltro.join(","))}` : "";

  return (
    <AppShell active="calendario">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Calendario</h1>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- mismo patrón que el resto del panel, sin next/link */}
        <a href="/ideas" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
          Ver notebook →
        </a>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <a
            href={`/ideas/calendario?mes=${claveMes(anterior.anio, anterior.mes)}${queryCuenta}`}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            ← Anterior
          </a>
          <span className="text-sm font-medium text-zinc-900">
            {NOMBRES_MES[mes - 1]} {anio}
          </span>
          <a
            href={`/ideas/calendario?mes=${claveMes(siguiente.anio, siguiente.mes)}${queryCuenta}`}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Siguiente →
          </a>
        </div>
        <FiltroCheckboxes
          name="cuentaId"
          etiqueta="Cuenta:"
          opciones={cuentas.map((cuenta) => ({ value: cuenta.id, label: cuenta.nombre }))}
          seleccionadas={cuentasFiltro}
        />
      </div>

      <CalendarioMes dias={dias} ideasPorDia={ideasPorDia} hoyClave={claveDia(new Date())} />
    </AppShell>
  );
}
