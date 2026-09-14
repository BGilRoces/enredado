# 03: Publicar un Post inmediato con imagen (Drive → Instagram)

**What to build:** El camino feliz completo pero angosto: elegir una imagen con el Google Picker, elegir la Cuenta de Instagram destino, escribir un caption, y publicarla ya mismo como Post real en Instagram. Primera vez que el Publicador funciona de punta a punta (Drive → Storage temporal → Meta → registro del resultado).

**Blocked by:** 02

**Status:** done (código); falta la infra real de Google Cloud + Supabase Storage para probar de punta a punta

- [x] Selector de Google Drive (Google Picker API) integrado en el panel; devuelve el archivo elegido sin listar/sincronizar todo el Drive del lado del servidor.
- [x] El usuario elige la Cuenta de Instagram destino entre las conectadas, y escribe un caption.
- [x] Al confirmar, el Publicador baja la imagen de Drive, la sube temporalmente a un bucket de Supabase Storage en `shared-infra`, genera la URL pública, crea el contenedor de media en la Graph API y lo publica.
- [x] El archivo temporal se borra de Storage una vez que Meta confirma la publicación (éxito o fallo definitivo) — y también en cualquier falla posterior a la subida (incluida una falla de Storage/Meta a mitad de camino).
- [x] Si el archivo no es un formato de imagen soportado por Instagram, el panel avisa antes de intentar publicar (sin gastar una llamada a Meta).
- [x] El resultado (publicado / falló, con motivo si falló) queda registrado y visible en el panel, aunque sea de forma mínima (todavía no es el historial completo del ticket 06).
- [x] El Publicador se testea con fakes de `DriveClient`, `MetaClient` y `StorageClient` — ningún test pega contra Drive/Meta/Supabase reales.

## Avance

**Hecho en código, verificado con tests/typecheck/build/lint (todo verde, 30 tests):**
- `prisma/schema.prisma`: modelo `Publicacion` nuevo (+ enums `TipoPublicacion`, `EstadoPublicacion`), relacionado a `Cuenta`. Migración en `prisma/migrations/20260914030000_publicaciones/` (generada con `prisma migrate diff --from-schema <schema viejo> --to-schema <schema nuevo> --script`, sin necesitar una DB real).
- `lib/publicador/publicar-post.ts` + test (6 casos): el seam principal. Dado un `PublicarPostInput` y los tres clientes inyectados (`DriveClient`, `StorageClient`, `MetaPublishClient`), baja de Drive, valida formato (Instagram solo acepta JPEG para Posts — PNG/WebP/GIF se rechazan sin llamar a Meta), sube a Storage, crea el contenedor y publica. Cualquier falla (Drive, Storage o Meta) se convierte en `{estado: "fallida", error}` en vez de propagar un throw; el archivo temporal se borra siempre que sí llegó a subirse (éxito o falla posterior), con limpieza best-effort para que un fallo al borrar no tape el resultado real.
- `lib/drive/client.ts`: adapter real de Google Drive (`GET .../files/{id}?alt=media` con el access token del Picker).
- `lib/storage/client.ts`: adapter real de Supabase Storage (bucket `SUPABASE_STORAGE_BUCKET`, service role key).
- `lib/meta/client.ts`: se agregó `metaPublishClient` (Content Publishing: `.../media` + `.../media_publish`), mismos nombres en inglés que `metaClient` para consistencia dentro del archivo.
- `lib/env.ts`: `requireEnv` compartido (antes duplicado entre `lib/meta/client.ts` y el nuevo `lib/storage/client.ts`).
- `app/publicar/`: `page.tsx` (lista Cuentas conectadas + últimas Publicaciones), `publicar-form.tsx` (Cuenta + caption + submit), `use-google-picker.ts` (hook que encapsula el login OAuth de Google y el Picker, separado del formulario), `actions.ts` (Server Action que orquesta: crea la Publicación en estado "publicando" *antes* de intentar nada, corre el Publicador con los adapters reales, y actualiza el resultado final).
- Pasó por `/code-review` (Standards + Spec) contra el punto de partida `671205f`:
  - **Spec, hallazgo real corregido**: el Publicador original solo capturaba fallas de Meta — una falla de Drive o de Storage al subir se propagaba sin capturar, dejando la Publicación trabada en "publicando" para siempre (contradice "el resultado... queda registrado"). Se corrigió envolviendo también esas etapas y se agregaron 2 tests nuevos para esos casos.
  - **Standards**: se corrigieron 4 hallazgos — nombres de métodos de `metaPublishClient` en español vs. inglés (inconsistente con `metaClient` en el mismo archivo), `requireEnv` duplicado, `ResultadoPublicacion` con su propia vocabulario de estados en vez de reusar el enum `EstadoPublicacion` de Prisma, y `publicar-form.tsx` mezclando la plomería del Google Picker con el estado del formulario (se separó en `use-google-picker.ts`).

**Pendiente — bloqueo real, no de código (mismo patrón que el ticket 02):**
- Crear credenciales de Google Cloud (OAuth Client ID + API key) para el Picker, habilitar Google Picker API + Google Drive API, configurar el origen autorizado (dominio de Coolify) y las restricciones del API key.
- Crear el bucket de Supabase Storage (`enredado-temp` o el nombre elegido) en `shared-infra` y conseguir el `SUPABASE_SERVICE_ROLE_KEY`.
- Cargar `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (y opcionalmente `SUPABASE_STORAGE_BUCKET`) en Coolify.
- Candidato a un próximo `/wizard`, igual que la App de Meta del ticket 02.
