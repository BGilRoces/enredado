export interface MetaClient {
  exchangeCodeForToken(
    code: string,
    redirectUri: string
  ): Promise<{ accessToken: string }>;
  getLongLivedToken(
    shortLivedToken: string
  ): Promise<{ accessToken: string; expiresInSeconds: number }>;
  /** Renovar un long-lived token ya emitido es un endpoint/grant distinto del de arriba — ver ADR-0012. */
  refreshLongLivedToken(
    accessToken: string
  ): Promise<{ accessToken: string; expiresInSeconds: number }>;
  getInstagramAccount(
    accessToken: string
  ): Promise<{ igUserId: string; igUsername: string }>;
}

export interface ResolvedAccount {
  nombre: string;
  igUserId: string;
  igUsername: string;
  accessToken: string;
  tokenExpiraEl: Date;
}

/**
 * Dado el `code` que Instagram manda al callback de OAuth, resuelve la
 * Cuenta de Instagram que se logueó (ver ADR-0012: Business Login for
 * Instagram autentica una sola Cuenta por vez, a diferencia del flujo viejo
 * que traía todas las Páginas de Facebook que administraba el usuario).
 */
export async function resolveInstagramAccount(
  code: string,
  redirectUri: string,
  client: MetaClient
): Promise<ResolvedAccount> {
  const { accessToken: shortLivedToken } = await client.exchangeCodeForToken(
    code,
    redirectUri
  );
  const { accessToken, expiresInSeconds } =
    await client.getLongLivedToken(shortLivedToken);
  const { igUserId, igUsername } = await client.getInstagramAccount(accessToken);

  return {
    nombre: igUsername,
    igUserId,
    igUsername,
    accessToken,
    tokenExpiraEl: new Date(Date.now() + expiresInSeconds * 1000),
  };
}
