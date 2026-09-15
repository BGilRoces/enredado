interface CuentaOption {
  id: string;
  nombre: string;
}

/**
 * Form GET reusado por /publicar y /historial para filtrar por Cuenta. Acepta
 * `children` para que /historial le sume el select de estado sin duplicar el
 * resto del form.
 */
export function CuentaFiltroForm({
  cuentas,
  cuentaSeleccionada,
  children,
}: {
  cuentas: CuentaOption[];
  cuentaSeleccionada: string;
  children?: React.ReactNode;
}) {
  return (
    <form className="flex flex-wrap items-center gap-2 text-sm">
      <select
        name="cuentaId"
        defaultValue={cuentaSeleccionada}
        className="rounded-lg border border-zinc-200 bg-white p-2 text-sm text-zinc-700 shadow-sm"
      >
        <option value="">Todas las Cuentas</option>
        {cuentas.map((cuenta) => (
          <option key={cuenta.id} value={cuenta.id}>
            {cuenta.nombre}
          </option>
        ))}
      </select>
      {children}
      <button
        type="submit"
        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
      >
        Filtrar
      </button>
    </form>
  );
}
