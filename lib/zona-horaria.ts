/**
 * El panel muestra y recibe todas las horas en Argentina (UTC-3, sin horario
 * de verano). En la base y en el servidor viajan como instantes UTC; estas
 * funciones son la única frontera de conversión.
 */
const OFFSET_HORAS = -3;
const OFFSET_MS = OFFSET_HORAS * 60 * 60 * 1000;
const SUFIJO_OFFSET = "-03:00";

/** "YYYY-MM-DDTHH:mm" con la hora de pared de Argentina. */
function paredISO(fecha: Date): string {
  return new Date(fecha.getTime() + OFFSET_MS).toISOString();
}

/** Valor para <input type="datetime-local">. */
export function aInputDatetimeLocal(fecha: Date | null): string {
  return fecha ? paredISO(fecha).slice(0, 16) : "";
}

/** Inverso de aInputDatetimeLocal: "YYYY-MM-DDTHH:mm" (hora Argentina) → instante. */
export function desdeHoraLocal(valor: string): Date {
  const conSegundos = valor.length === 16 ? `${valor}:00` : valor;
  return new Date(`${conSegundos}${SUFIJO_OFFSET}`);
}

/** "YYYY-MM-DD HH:mm" en hora Argentina. */
export function formatearFechaHora(fecha: Date): string {
  return paredISO(fecha).slice(0, 16).replace("T", " ");
}

/** "YYYY-MM-DD" del día en Argentina. */
export function claveDiaLocal(fecha: Date): string {
  return paredISO(fecha).slice(0, 10);
}

/** "HH:mm" en hora Argentina. */
export function horaLocal(fecha: Date): string {
  return paredISO(fecha).slice(11, 16);
}

/** Instante en que empieza ese día calendario en Argentina (clave "YYYY-MM-DD"). */
export function inicioDeDiaLocal(clave: string): Date {
  return desdeHoraLocal(`${clave}T00:00`);
}
