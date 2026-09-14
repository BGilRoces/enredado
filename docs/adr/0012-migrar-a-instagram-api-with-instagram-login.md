# Migrar a "Instagram API with Instagram Login" (Business Login for Instagram)

Publicar un Post real (después de que el resto del pipeline — Drive, conversión a JPEG, carousel — ya funcionaba) empezó a fallar con `Meta rechazó la solicitud: (#10) Requires instagram_content_publish permission to manage the object`. El token guardado por Cuenta ya era el correcto (Page Access Token, ver `lib/meta/resolve-accounts.ts`) y la renovación automática (ticket 07) no le tocaba permisos — no era un bug de este código.

La causa real: **Meta discontinuó los permisos `instagram_basic`/`instagram_content_publish` el 27 de enero de 2025.** La Login Configuration armada en el ticket 02 (2026-09-13, más de un año después de la baja) pedía esos permisos igual — el dashboard de Meta lo permitió sin avisar, pero como están dados de baja, nunca los otorga de verdad. Por eso ni agregar la Cuenta como Instagram Tester ni reconectarla lo iba a arreglar nunca: el flujo entero (ADR-0008) estaba condenado desde que se armó, no por un error de configuración puntual.

El reemplazo de esos permisos (`instagram_business_basic`, `instagram_business_content_publish`) sólo se otorga a través de un producto distinto de Meta: **"Instagram API with Instagram Login"**, con su propio login directo (`https://www.instagram.com/oauth/authorize`, Business Login for Instagram) y su propio App ID/Secret — ya no depende de una Página de Facebook ni de una Login Configuration, los permisos van directo en el `scope` de la URL de login, como el login clásico de antes de que existiera Facebook Login for Business.

**Qué no cambia**: el modelo de contenedores para publicar (`image_url`/`video_url`, `is_carousel_item`, `media_type=CAROUSEL`, `children`, `media_publish` con `creation_id`) es idéntico entre ambos productos — confirmado contra la documentación oficial. Todo `lib/publicador/*` y la lógica de carousel (ADR-0011) siguen iguales; sólo cambia el host (`graph.instagram.com` en vez de `graph.facebook.com`) en `lib/meta/client.ts`.

**Qué cambia**:
- Login directo con la Cuenta de Instagram (`lib/meta/oauth-url.ts`), sin Página de Facebook de por medio.
- Cada autorización resuelve **una sola Cuenta** (`resolveInstagramAccount`, singular), no todas las Páginas que administra un usuario — conectar varias Cuentas son varias pasadas por el flujo, cada una logueándose con la cuenta correspondiente.
- Renovar un token ya emitido es un endpoint/grant distinto (`ig_refresh_token` sobre `graph.instagram.com/refresh_access_token`) del que se usa para el intercambio inicial corto→largo (`ig_exchange_token`) — no son intercambiables como el `fb_exchange_token` de Facebook, que servía para las dos cosas con el mismo llamado.
- `Cuenta.pageId` se elimina del modelo: sin Página de Facebook no hay nada que guardar ahí.

**Costo real**: las Cuentas ya conectadas con el flujo viejo tienen tokens que nunca van a poder publicar — hay que desconectarlas y reconectarlas todas después de este cambio.
