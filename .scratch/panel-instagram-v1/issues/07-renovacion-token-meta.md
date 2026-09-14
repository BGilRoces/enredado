# 07: Renovación automática del token de Meta

**What to build:** Que el token de acceso de cada Cuenta de Instagram se renueve solo antes de vencer (los long-lived tokens de Meta duran ~60 días), sin que haga falta reconectar la cuenta a mano.

**Blocked by:** 02

**Status:** done (código) — no depende de la infra de Google/Storage de los tickets 03-06, esto ya se puede probar en vivo apenas pase un ciclo del worker

- [x] El panel sabe la fecha de vencimiento del token de cada Cuenta conectada.
- [x] Antes de que el token de una Cuenta venza, el panel lo renueva automáticamente vía la Graph API, sin intervención manual.
- [x] Si la renovación falla (por ejemplo, el usuario revocó el acceso desde Meta), la Cuenta queda marcada como "necesita reconexión" en vez de fallar en silencio la próxima vez que se intente publicar con ella.
- [x] La lógica de renovación se testea con un fake del cliente de Meta, sin pegar contra la API real ni depender de esperar 60 días de verdad.

## Avance

**Hecho en código, verificado con tests/typecheck/build/lint (todo verde, 54 tests):**
- `lib/renovacion-token/necesita-renovacion.ts` (5 tests): función pura, decide si hay que renovar dado "ahora", el vencimiento y un margen — se usa 7 días de margen sobre los ~60 días que duran los tokens.
- `lib/renovacion-token/renovar-token.ts` (2 tests, con `vi.useFakeTimers()`): le pide a Meta un token nuevo reusando `MetaClient.getLongLivedToken` (el mismo método que ya existía desde el ticket 02 para el intercambio inicial — es el mecanismo real que Meta documenta para extender un long-lived token).
- `lib/worker/token-renewal-worker.ts`: mismo patrón que `lib/worker/publicador-worker.ts` (ticket 05) — `tick()` reentrante-seguro, revisa las Cuentas conectadas cada 12 horas (margen de sobra para una ventana de renovación de 7 días), y por cada una que lo necesite renueva o, si Meta rechaza, la marca `necesitaReconexion`.
- **ADR-0010, decisión de dominio nueva**: se agregó `necesitaReconexion` como tercer valor de `EstadoCuenta`, distinto de `desconectada` — esa siempre significó "el dueño la desconectó a propósito", y confundir ahí un rechazo de Meta habría perdido esa distinción. `CONTEXT.md` actualizado. El Publicador (ticket 03/05) ya trataba cualquier estado que no fuera `conectada` como no publicable, así que no necesitó cambios.
- `app/cuentas/page.tsx`: la Cuenta en `necesitaReconexion` se ve distinta (texto en rojo) con un botón "Reconectar" que reusa el mismo flujo OAuth del ticket 02 (hace upsert por `igUserId`, así que reconectar la vuelve a dejar `conectada` sola).
- `instrumentation.ts` ahora arranca dos workers en memoria (el de Publicaciones y este), mismo mecanismo, sin sumar ningún servicio nuevo.
- **Bug de infra de tests encontrado y corregido, no relacionado al ticket en sí**: al escribir `renovar-token.ts` (que importa `@/lib/mensaje-de-error`) se descubrió que `vitest.config.mts` nunca tuvo configurado el alias `@/*` que usa el resto del código — ningún test anterior lo había ejercitado ni siquiera transitivamente, así que pasó desapercibido hasta ahora. Se agregó la resolución del alias a `vitest.config.mts` (sin sumar una dependencia nueva) y se aprovechó para sacar el warning de `__dirname` deprecado.
- De paso, `lib/publicador/mensaje-de-error.ts` (creado en el ticket 05) se movió a `lib/mensaje-de-error.ts`: ya no es específico del Publicador, este ticket lo empezó a usar también desde `lib/renovacion-token/`.
- Pasó por `/code-review` (Standards + Spec) contra el punto de partida del ticket 06 (`eca178b`): sin hallazgos duros. Se aplicaron igual dos mejoras de consistencia que señaló Standards (judgement calls, no bugs): agregar la guardia de reentrancia al `tick()` del worker (mismo patrón que el de Publicaciones) y extraer el manejo de una Cuenta a una función nombrada (`renovarCuenta`) en vez de dejarlo inline en el loop.
