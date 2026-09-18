# 02: Acceso a Google Drive del lado del servidor

**What to build:** OAuth offline de Google (consentimiento único), `DriveCredencial` cifrada, mint de access token bajo demanda, pantalla `/configuracion`.

**Blocked by:** 01

**Status:** done (código) — bloqueado para probar de verdad: falta que Bautista saque `GOOGLE_CLIENT_SECRET` de Google Cloud Console y corra el consentimiento en `/configuracion`

- [x] `lib/config/app-url.ts` (extracción de `APP_URL`, ya no específico de Meta).
- [x] `lib/drive-oauth/config.ts`, `oauth-url.ts` (+ test), `callback-outcome.ts` (+ test).
- [x] `lib/drive-oauth/exchange-code.ts`, `lib/drive-oauth/mint-access-token.ts`.
- [x] `app/api/drive/connect/route.ts`, `app/api/drive/callback/route.ts`.
- [x] `app/configuracion/page.tsx` — sólo dueño del panel, nunca un Colaborador restringido.
- [x] `.env.example` con `GOOGLE_CLIENT_SECRET`.
- [ ] Probado de verdad: requiere el secret real + consentimiento manual — no se puede verificar sin eso.

## Avance

Escrito completo aunque el plan original lo daba por bloqueado hasta tener el secret: escribir el código no lo necesita (sólo referenciarlo vía `process.env.GOOGLE_CLIENT_SECRET`, mismo patrón que `INSTAGRAM_APP_SECRET`), y el issue 03 depende de estos módulos para compilar. `npx tsc --noEmit`, lint y `npm run build` pasan sin el secret configurado (nunca se ejecuta en build time). Pendiente real: Bautista tiene que (1) sacar el Client secret del mismo OAuth Client "Aplicación web" que ya usa `NEXT_PUBLIC_GOOGLE_CLIENT_ID` en Google Cloud Console, (2) ponerlo en `.env.local`/producción, (3) entrar a `/configuracion` y conectar Drive una vez.
