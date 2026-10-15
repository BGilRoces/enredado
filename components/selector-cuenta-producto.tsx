"use client";

import { useState } from "react";

interface CuentaOpcion {
  id: string;
  nombre: string;
  productos: { id: string; nombre: string }[];
}

const INPUT_CLASS =
  "rounded-lg border border-zinc-300 p-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

/** Selects de Cuenta y Producto del form de nueva idea: el de Producto sólo lista los de la Cuenta elegida. */
export function SelectorCuentaProducto({ cuentas }: { cuentas: CuentaOpcion[] }) {
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id ?? "");
  const productos = cuentas.find((cuenta) => cuenta.id === cuentaId)?.productos ?? [];

  return (
    <>
      <select
        name="cuentaId"
        required
        value={cuentaId}
        onChange={(evento) => setCuentaId(evento.target.value)}
        className={`${INPUT_CLASS} flex-1`}
      >
        {cuentas.map((cuenta) => (
          <option key={cuenta.id} value={cuenta.id}>
            {cuenta.nombre}
          </option>
        ))}
      </select>
      {productos.length > 0 && (
        // key: al cambiar de Cuenta se reinicia a "General" en vez de arrastrar un producto ajeno.
        <select key={cuentaId} name="productoId" defaultValue="" className={`${INPUT_CLASS} flex-1`}>
          <option value="">General (marca)</option>
          {productos.map((producto) => (
            <option key={producto.id} value={producto.id}>
              {producto.nombre}
            </option>
          ))}
        </select>
      )}
    </>
  );
}
