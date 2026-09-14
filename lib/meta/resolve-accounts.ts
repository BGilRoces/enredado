export interface MetaPage {
  id: string;
  name: string;
  access_token: string;
}

export interface MetaClient {
  exchangeCodeForToken(
    code: string,
    redirectUri: string
  ): Promise<{ accessToken: string }>;
  getLongLivedToken(
    shortLivedToken: string
  ): Promise<{ accessToken: string; expiresInSeconds: number }>;
  getUserPages(userToken: string): Promise<MetaPage[]>;
  getPageInstagramAccount(
    pageId: string,
    pageAccessToken: string
  ): Promise<{ igUserId: string; igUsername: string } | null>;
}

export interface ResolvedAccount {
  nombre: string;
  igUserId: string;
  igUsername: string;
  pageId: string;
  accessToken: string;
  tokenExpiraEl: Date;
}

/**
 * Dado el `code` que Meta manda al callback de OAuth, resuelve todas las
 * Cuentas de Instagram vinculadas a las Páginas de Facebook que el usuario
 * autorizó. Las Páginas sin una Cuenta de Instagram vinculada se descartan.
 */
export async function resolveInstagramAccounts(
  code: string,
  redirectUri: string,
  client: MetaClient
): Promise<ResolvedAccount[]> {
  const { accessToken: shortLivedToken } = await client.exchangeCodeForToken(
    code,
    redirectUri
  );
  const { accessToken: userToken, expiresInSeconds } =
    await client.getLongLivedToken(shortLivedToken);
  const pages = await client.getUserPages(userToken);

  const resolved: ResolvedAccount[] = [];
  const tokenExpiraEl = new Date(Date.now() + expiresInSeconds * 1000);

  for (const page of pages) {
    const igAccount = await client.getPageInstagramAccount(
      page.id,
      page.access_token
    );
    if (!igAccount) continue;

    resolved.push({
      nombre: page.name,
      igUserId: igAccount.igUserId,
      igUsername: igAccount.igUsername,
      pageId: page.id,
      accessToken: page.access_token,
      tokenExpiraEl,
    });
  }

  return resolved;
}
