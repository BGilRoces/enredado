# 06: Calendario mensual

**What to build:** Vista de calendario por mes, sin librería nueva.

**Blocked by:** 04

**Status:** done

- [x] `lib/calendario/mes-en-grilla.ts` (+ test) — grilla 6×7 pura, con bordes de mes/año.
- [x] `app/ideas/calendario/page.tsx` — navegación `?mes=YYYY-MM`, sin JS de cliente.
- [x] `components/calendario-mes.tsx`.

## Avance

Semana arranca lunes (convención local). `CuentaFiltroForm` recibe el mes actual como campo oculto vía su slot `children`, para no perder el mes al filtrar por Cuenta (si no, el GET plano lo resetearía al mes en curso). Sin librería de calendario ni JS de cliente, como establecía el plan.
