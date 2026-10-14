# Servidor MCP dentro del panel, con token propio, para gestionarlo desde Claude

Bautista quiere cargar y programar contenido (ideas, calendario, captions, posts/carousels/historias/reels) hablándole a Claude desde el celu, sin abrir el panel. Para eso el panel expone un servidor MCP remoto en `/api/mcp` que se agrega como conector personalizado en claude.ai (y sirve igual desde Claude Code).

**Transporte propio, sin SDK.** Se implementa el mínimo del protocolo (`initialize`, `ping`, `tools/list`, `tools/call`) sobre un POST stateless que responde JSON (`lib/mcp/protocolo.ts`). El SDK oficial suma dependencias y sesiones en memoria que no hacen falta, y el panel comparte VPS (ADR-0003).

**Todo pasa por Ideas.** No hay herramienta "publicar archivo": una Idea con `driveLink` + `programadaPara` es exactamente lo que ADR-0013/0015/0016 ya modelan (promoción lazy, carpeta = carousel o historias en orden). Reusa las mismas acciones que usa la UI (`app/ideas/actions.ts`) en vez de duplicar reglas. El archivo nunca viaja por el MCP: Claude lo sube a Drive (con su conector de Drive) y pasa el link — mover binarios en base64 por JSON-RPC sería lento y caro.

**Autenticación: token estático, fuera del login de Supabase.** `/api/mcp` queda exento de `proxy.ts` (`SELF_AUTHENTICATED_PREFIXES`) y valida `MCP_API_TOKEN` en tiempo constante, por `Authorization: Bearer` o como segmento de la URL (`/api/mcp/<token>`), porque el formulario de conectores personalizados de claude.ai no permite headers propios. Menos de 32 caracteres = cerrado.

Alternativa descartada por ahora: OAuth 2.1 completo (DCR + PKCE + consent con la sesión de Supabase). Es lo correcto cuando haya Colaboradores — permitiría atar cada conector a un usuario y a sus Cuentas (`app_metadata.cuentaId`). Hoy hay un único dueño, y el token en la URL da el mismo nivel de acceso con una fracción del código.

**Consecuencias.**
- El token da control total del contenido (crear, programar, borrar): tratarlo como una contraseña. Aparece en la URL, o sea en logs del proxy de Coolify; rotarlo es cambiar la env var y la URL del conector.
- Las acciones corren sin sesión de Supabase, así que `asegurarAccesoACuenta` no restringe (queda como "dueño"). Si se agregan Colaboradores con MCP, hay que pasar a OAuth y propagar la identidad.
- No hay rate limit propio; el token de 256 bits hace inviable la fuerza bruta.
- El MCP rechaza fechas pasadas: "publicar ya" se pide programando unos minutos adelante, a propósito (ver ADR-0018).
