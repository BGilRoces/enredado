# Login exige `app_metadata.app = "enredado"`, no solo una sesión válida

ADR-0003 decidió reusar el Supabase Auth de `shared-infra`, que ya es compartido por `tropero`, `sistemas` y `bertha`. Al revisar el middleware real de `sistemas` (`saume-sistema/apps/saume/middleware.ts`) encontramos que ese proyecto ya tuvo que resolver este mismo problema: una sesión válida en una instancia de Supabase Auth compartida es válida para *cualquier* app que apunte a esa instancia, no solo para la que el usuario cree que está usando. `sistemas` lo resuelve comparando `app_metadata.empresa` contra un slug propio de cada app.

Decidimos aplicar el mismo mecanismo acá: cada usuario de este panel debe tener `app_metadata.app = "enredado"` (seteado a mano en Supabase Studio al crear el usuario), y el middleware (`proxy.ts` / `lib/auth/decide-redirect.ts`) trata como no-autenticada cualquier sesión que no tenga ese claim, aunque sea una sesión de Supabase Auth perfectamente válida de otra app.

Por qué: sin este chequeo, cualquier credencial válida en `shared-infra` (por ejemplo, un colaborador invitado al panel de `sistemas`) podría loguearse en `enredado` sin haber sido invitado nunca a este panel — un agujero real de aislamiento entre proyectos, no solo teórico, porque ya está resuelto (y por lo tanto probado en producción) en `sistemas`.
