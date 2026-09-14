import { TipoPublicacion } from "@prisma/client";
import type { MetaClient } from "./resolve-accounts";
import type {
  CrearContenedorCarouselInput,
  CrearContenedorInput,
  EstadoContenedor,
  MetaPublishClient,
} from "@/lib/publicador/types";
import { requireEnv } from "@/lib/env";
import { GRAPH_VERSION } from "./config";

/** Content publishing sigue versionado igual que antes (ver ADR-0012) — sólo cambia el host. */
const INSTAGRAM_GRAPH_BASE = `https://graph.instagram.com/${GRAPH_VERSION}`;

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

async function graphGet(url: string, params: Record<string, string>) {
  const target = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    target.searchParams.set(key, value);
  }
  const res = await fetch(target);
  return parseGraphResponse(res, await res.json());
}

async function graphPost(url: string, params: Record<string, string>) {
  const res = await fetch(url, {
    method: "POST",
    body: new URLSearchParams(params),
  });
  return parseGraphResponse(res, await res.json());
}

/**
 * Cliente real de Business Login for Instagram (producto "Instagram API with
 * Instagram Login" de Meta, ver ADR-0012). Reemplaza el login clásico vía
 * Facebook Page — acá se loguea directo con la Cuenta de Instagram, un id de
 * app (`INSTAGRAM_APP_ID`/`INSTAGRAM_APP_SECRET`) propio y distinto del de
 * Facebook. Ver lib/meta/resolve-accounts.ts para el uso.
 */
export const metaClient: MetaClient = {
  async exchangeCodeForToken(code, redirectUri) {
    const body = await graphPost("https://api.instagram.com/oauth/access_token", {
      client_id: requireEnv("INSTAGRAM_APP_ID"),
      client_secret: requireEnv("INSTAGRAM_APP_SECRET"),
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    });
    return { accessToken: body.data?.[0]?.access_token as string };
  },

  async getLongLivedToken(shortLivedToken) {
    const body = await graphGet("https://graph.instagram.com/access_token", {
      grant_type: "ig_exchange_token",
      client_secret: requireEnv("INSTAGRAM_APP_SECRET"),
      access_token: shortLivedToken,
    });
    return {
      accessToken: body.access_token as string,
      expiresInSeconds: (body.expires_in as number) ?? 60 * 24 * 60 * 60,
    };
  },

  /**
   * Endpoint y grant distintos del de arriba (ver ADR-0012): sólo sirve
   * sobre un long-lived ya emitido, de al menos 24hs — no son
   * intercambiables como el `fb_exchange_token` de Facebook, que hacía las
   * dos cosas con el mismo llamado.
   */
  async refreshLongLivedToken(accessToken) {
    const body = await graphGet("https://graph.instagram.com/refresh_access_token", {
      grant_type: "ig_refresh_token",
      access_token: accessToken,
    });
    return {
      accessToken: body.access_token as string,
      expiresInSeconds: (body.expires_in as number) ?? 60 * 24 * 60 * 60,
    };
  },

  async getInstagramAccount(accessToken) {
    const body = await graphGet(`${INSTAGRAM_GRAPH_BASE}/me`, {
      fields: "id,username",
      access_token: accessToken,
    });
    return { igUserId: body.id as string, igUsername: body.username as string };
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

/** Cliente real de Content Publishing contra graph.instagram.com (ver ADR-0012). Ver lib/publicador/publicar.ts. */
export const metaPublishClient: MetaPublishClient = {
  async createContainer(igUserId, accessToken, input) {
    const body = await graphPost(`${INSTAGRAM_GRAPH_BASE}/${igUserId}/media`, {
      ...buildContainerParams(input),
      access_token: accessToken,
    });
    return { containerId: body.id as string };
  },

  /** Ver ADR-0011: primero un contenedor hijo por elemento, después el contenedor padre CAROUSEL con la lista de hijos. */
  async createCarouselContainer(igUserId, accessToken, input) {
    const childIds: string[] = [];
    for (const item of input.items) {
      const body = await graphPost(`${INSTAGRAM_GRAPH_BASE}/${igUserId}/media`, {
        ...buildCarouselChildParams(item),
        access_token: accessToken,
      });
      childIds.push(body.id as string);
    }

    const body = await graphPost(`${INSTAGRAM_GRAPH_BASE}/${igUserId}/media`, {
      media_type: "CAROUSEL",
      children: childIds.join(","),
      ...(input.caption ? { caption: input.caption } : {}),
      access_token: accessToken,
    });
    return { containerId: body.id as string };
  },

  async getContainerStatus(igUserId, accessToken, containerId) {
    const body = await graphGet(`${INSTAGRAM_GRAPH_BASE}/${containerId}`, {
      fields: "status_code",
      access_token: accessToken,
    });
    return containerStatusFromGraph(body.status_code as string);
  },

  async publishContainer(igUserId, accessToken, containerId) {
    const body = await graphPost(`${INSTAGRAM_GRAPH_BASE}/${igUserId}/media_publish`, {
      creation_id: containerId,
      access_token: accessToken,
    });
    return { mediaId: body.id as string };
  },
};
