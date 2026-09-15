import type { DriveClient } from "@/lib/publicador/types";

const SHORTCUT_MIME_TYPE = "application/vnd.google-apps.shortcut";

/** Google exige mandar el id y su resourceKey juntos en este formato. */
function headersDrive(accessToken: string, driveFileId: string, resourceKey?: string): HeadersInit {
  const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
  if (resourceKey) headers["X-Goog-Drive-Resource-Keys"] = `${driveFileId}/${resourceKey}`;
  return headers;
}

/**
 * El status HTTP solo (404, 403...) no alcanza para diagnosticar Drive: el
 * cuerpo de error de Google trae la razón real (permisos insuficientes,
 * scope, archivo inexistente, etc. — cada una pide un fix distinto). Nunca
 * descartar ese cuerpo aunque no sea JSON válido.
 *
 * También se suma qué cuenta de Google es la autenticada con ese token: la
 * app maneja varias empresas/Cuentas de Instagram, cada una con su propio
 * Drive (por eso el selector de cuenta de Google es forzado en el Picker,
 * ver "Forzar selector de cuenta de Google en el Picker") — un "File not
 * found" en un archivo recién elegido es la firma típica de haber elegido el
 * archivo en una cuenta y autorizado el token con otra.
 */
async function mensajeErrorGoogle(res: Response, accion: string, accessToken: string): Promise<string> {
  const cuerpo = await res.text();
  let detalle: string;
  try {
    detalle = JSON.parse(cuerpo)?.error?.message ?? cuerpo;
  } catch {
    detalle = cuerpo;
  }

  let cuenta = "no se pudo determinar";
  try {
    const infoRes = await fetch("https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (infoRes.ok) cuenta = (await infoRes.json())?.user?.emailAddress ?? cuenta;
  } catch {
    // Best-effort: si esto falla, se informa el error original igual.
  }

  return `Google Drive respondió ${res.status} al ${accion} (autenticado como ${cuenta})${detalle ? `: ${detalle}` : ""}`;
}

/**
 * Resuelve el id (y resourceKey, si corresponde) con el que hay que pedir el
 * contenido real, cubriendo dos casos que la API trata como "no existe"
 * (404) si no se manejan:
 *
 * - Acceso directo (shortcut): lo que el Picker muestra al navegar
 *   "Compartido conmigo" (Drive organiza casi todo así desde 2020) tiene su
 *   propio id, pero ese id no tiene contenido propio — hay que resolverlo al
 *   id real vía `shortcutDetails.targetId` (con su propio `targetResourceKey`,
 *   si el shortcut tenía uno).
 * - Resource key: un archivo compartido por link (no compartido directo con
 *   la cuenta) exige mandar su `resourceKey` junto al id desde 2021 — el
 *   Picker lo entrega junto al doc elegido (`doc.resourceKey`).
 */
async function resolverArchivoReal(
  driveFileId: string,
  accessToken: string,
  resourceKey: string | undefined
): Promise<{ id: string; resourceKey?: string; error?: string }> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${driveFileId}` +
      "?fields=id,mimeType,shortcutDetails&supportsAllDrives=true",
    { headers: headersDrive(accessToken, driveFileId, resourceKey) }
  );
  if (!res.ok) {
    return { id: driveFileId, error: await mensajeErrorGoogle(res, "leer el archivo", accessToken) };
  }
  const meta = await res.json();
  if (meta.mimeType === SHORTCUT_MIME_TYPE && meta.shortcutDetails?.targetId) {
    return {
      id: meta.shortcutDetails.targetId as string,
      resourceKey: meta.shortcutDetails.targetResourceKey as string | undefined,
    };
  }
  return { id: meta.id as string, resourceKey };
}

/**
 * Cliente real de Google Drive. El access token viene del picker del lado
 * del cliente (OAuth, scope drive.readonly — el Picker de Google en desktop,
 * uno propio en mobile, ver use-google-picker.ts) — el servidor nunca lista
 * ni sincroniza el Drive, solo baja el archivo puntual que el usuario eligió.
 */
export const driveClient: DriveClient = {
  async descargarArchivo(driveFileId, accessToken, resourceKey) {
    const real = await resolverArchivoReal(driveFileId, accessToken, resourceKey);
    if (real.error) throw new Error(real.error);

    const res = await fetch(
      // supportsAllDrives=true: sin esto, Google Drive devuelve 404 al pedir
      // un archivo que vive en una Unidad compartida (Shared Drive) en vez de
      // "Mi unidad" — el Picker deja navegar y elegir esos archivos igual
      // (ver "Permitir navegar carpetas de Drive en el selector de archivos").
      `https://www.googleapis.com/drive/v3/files/${real.id}?alt=media&supportsAllDrives=true`,
      { headers: headersDrive(accessToken, real.id, real.resourceKey) }
    );
    if (!res.ok) {
      throw new Error(await mensajeErrorGoogle(res, "descargar el archivo", accessToken));
    }
    const mimeType = res.headers.get("content-type") ?? "application/octet-stream";
    const data = Buffer.from(await res.arrayBuffer());
    return { data, mimeType };
  },
};
