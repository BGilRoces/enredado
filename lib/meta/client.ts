import { TipoPublicacion } from "@prisma/client";
import type { MetaClient, MetaPage } from "./resolve-accounts";
import type {
  CrearContenedorCarouselInput,
  CrearContenedorInput,
  EstadoContenedor,
  MetaPublishClient,
} from "@/lib/publicador/types";
import { requireEnv } from "@/lib/env";
import { GRAPH_VERSION } from "./config";

const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseGraphResponse(res: Response, body: any) {
  if (!res.ok) {
    // Meta.error.message ya viene en texto legible; si no vino (respuesta
    // rara/malformada), no mostramos el código HTTP pelado (ticket 06).
    const motivo = body?.error?.message ?? `sin más detalle (HTTP ${res.status})`;
    throw new Error(`Meta rechazó la solicitud: ${motivo}`);
  }
  return body;
}

async function graphGet(path: string, params: Record<string, string>) {
  const url = new URL(`${GRAPH_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url);
  return parseGraphResponse(res, await res.json());
}

async function graphPost(path: string, params: Record<string, string>) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method: "POST",
    body: new URLSearchParams(params),
  });
  return parseGraphResponse(res, await res.json());
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

/** Traduce nuestro (tipoPublicacion, tipo de media) a los params de la Graph API. */
function buildContainerParams(input: CrearContenedorInput): Record<string, string> {
  const params: Record<string, string> = {};

  if (input.media.tipo === "video") {
    params.video_url = input.media.url;
  } else {
    params.image_url = input.media.url;
  }

  if (input.tipoPublicacion === TipoPublicacion.reel) {
    params.media_type = "REELS";
  } else if (input.tipoPublicacion === TipoPublicacion.historia) {
    params.media_type = "STORIES";
  } else if (input.media.tipo === "video") {
    params.media_type = "VIDEO"; // Post + imagen no lleva media_type (default: foto de feed).
  }

  if (input.caption) {
    params.caption = input.caption;
  }

  return params;
}

/** Params para un elemento hijo de un carousel — nunca lleva caption ni media_type de STORIES/REELS. */
function buildCarouselChildParams(item: CrearContenedorCarouselInput["items"][number]): Record<string, string> {
  const params: Record<string, string> = { is_carousel_item: "true" };
  if (item.tipo === "video") {
    params.video_url = item.url;
    params.media_type = "VIDEO";
  } else {
    params.image_url = item.url;
  }
  return params;
}

function containerStatusFromGraph(statusCode: string): EstadoContenedor {
  if (statusCode === "FINISHED" || statusCode === "PUBLISHED") return "listo";
  if (statusCode === "IN_PROGRESS") return "en_progreso";
  return "error"; // ERROR, EXPIRED, o cualquier otro valor inesperado.
}

/** Cliente real de Content Publishing contra la Graph API. Ver lib/publicador/publicar.ts. */
export const metaPublishClient: MetaPublishClient = {
  async createContainer(igUserId, accessToken, input) {
    const body = await graphPost(`/${igUserId}/media`, {
      ...buildContainerParams(input),
      access_token: accessToken,
    });
    return { containerId: body.id as string };
  },

  /** Ver ADR-0011: primero un contenedor hijo por elemento, después el contenedor padre CAROUSEL con la lista de hijos. */
  async createCarouselContainer(igUserId, accessToken, input) {
    const childIds: string[] = [];
    for (const item of input.items) {
      const body = await graphPost(`/${igUserId}/media`, {
        ...buildCarouselChildParams(item),
        access_token: accessToken,
      });
      childIds.push(body.id as string);
    }

    const body = await graphPost(`/${igUserId}/media`, {
      media_type: "CAROUSEL",
      children: childIds.join(","),
      ...(input.caption ? { caption: input.caption } : {}),
      access_token: accessToken,
    });
    return { containerId: body.id as string };
  },

  async getContainerStatus(igUserId, accessToken, containerId) {
    const body = await graphGet(`/${containerId}`, {
      fields: "status_code",
      access_token: accessToken,
    });
    return containerStatusFromGraph(body.status_code as string);
  },

  async publishContainer(igUserId, accessToken, containerId) {
    const body = await graphPost(`/${igUserId}/media_publish`, {
      creation_id: containerId,
      access_token: accessToken,
    });
    return { mediaId: body.id as string };
  },
};
