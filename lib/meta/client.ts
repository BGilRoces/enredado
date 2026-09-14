import type { MetaClient, MetaPage } from "./resolve-accounts";
import { GRAPH_VERSION } from "./config";

const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} no está configurado (ver .env.example)`);
  return value;
}

async function graphGet(path: string, params: Record<string, string>) {
  const url = new URL(`${GRAPH_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) {
    const message = body?.error?.message ?? `Graph API respondió ${res.status}`;
    throw new Error(message);
  }
  return body;
}

/** Cliente real contra la Graph API de Meta. Ver lib/meta/resolve-accounts.ts para el uso. */
export const metaClient: MetaClient = {
  async exchangeCodeForToken(code, redirectUri) {
    const body = await graphGet("/oauth/access_token", {
      client_id: requireEnv("META_APP_ID"),
      client_secret: requireEnv("META_APP_SECRET"),
      redirect_uri: redirectUri,
      code,
    });
    return { accessToken: body.access_token as string };
  },

  async getLongLivedToken(shortLivedToken) {
    const body = await graphGet("/oauth/access_token", {
      grant_type: "fb_exchange_token",
      client_id: requireEnv("META_APP_ID"),
      client_secret: requireEnv("META_APP_SECRET"),
      fb_exchange_token: shortLivedToken,
    });
    return {
      accessToken: body.access_token as string,
      expiresInSeconds: (body.expires_in as number) ?? 60 * 24 * 60 * 60,
    };
  },

  async getUserPages(userToken) {
    const body = await graphGet("/me/accounts", { access_token: userToken });
    return (body.data ?? []) as MetaPage[];
  },

  async getPageInstagramAccount(pageId, pageAccessToken) {
    const body = await graphGet(`/${pageId}`, {
      fields: "instagram_business_account{id,username}",
      access_token: pageAccessToken,
    });
    const ig = body.instagram_business_account;
    if (!ig) return null;
    return { igUserId: ig.id as string, igUsername: ig.username as string };
  },
};
