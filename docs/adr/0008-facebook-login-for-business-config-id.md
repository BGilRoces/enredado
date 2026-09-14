# Usar Facebook Login for Business (`config_id`) en vez de `scope` en el diálogo de OAuth

ADR-0001 asumía el login clásico de Facebook: una App de Meta con el producto "Facebook Login", permisos pasados como `scope` en la URL del diálogo de OAuth. Al crear la App real (tipo Business, necesaria para el resto de las decisiones de ADR-0001), el dashboard de Meta no ofrece ese use case clásico — solo expone "Manage messaging & content on Instagram" y "Manage everything on your Page", que dependen de **Facebook Login for Business**, no del login clásico.

Facebook Login for Business no acepta una lista de `scope` sueltos en el diálogo de OAuth: los permisos se configuran de antemano en el dashboard de Meta como una **Login Configuration**, identificada por un `config_id`, que reemplaza al parámetro `scope` en la URL (`client_id`, `redirect_uri`, `state` y `response_type` se mantienen igual, así como el endpoint de intercambio del código por el token).

Decidimos adaptar `buildAuthorizeUrl` para mandar `config_id` (leído de `META_LOGIN_CONFIG_ID`) en vez de `scope`. Los permisos concretos (`pages_show_list`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`) quedan declarados del lado de Meta, en esa Configuration — no en el código. Si se necesita un permiso nuevo a futuro, hay que sumarlo ahí y no alcanza con tocar el código.
