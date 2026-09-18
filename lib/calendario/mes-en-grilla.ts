export interface DiaDeGrilla {
  /** Medianoche UTC de ese día. */
  fecha: Date;
  delMesActual: boolean;
}

/**
 * Función pura: arma una grilla de 6 semanas (42 días, lunes a domingo) para
 * el mes pedido, incluyendo los días de los meses vecinos que completan la
 * primera y última semana — igual que cualquier calendario mensual estándar.
 * `mes` es 1-12.
 */
export function mesEnGrilla(anio: number, mes: number): DiaDeGrilla[] {
  const primerDiaMes = new Date(Date.UTC(anio, mes - 1, 1));
  // getUTCDay(): 0=domingo..6=sábado. Semana arranca lunes acá.
  const diasDesdeLunes = (primerDiaMes.getUTCDay() + 6) % 7;
  const inicio = new Date(Date.UTC(anio, mes - 1, 1 - diasDesdeLunes));

  return Array.from({ length: 42 }, (_, i) => {
    const fecha = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate() + i));
    return { fecha, delMesActual: fecha.getUTCMonth() === mes - 1 };
  });
}
