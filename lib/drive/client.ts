import type { DriveClient } from "@/lib/publicador/types";

const SHORTCUT_MIME_TYPE = "application/vnd.google-apps.shortcut";

/**
 * Un "acceso directo" de Drive (ej.: lo que el Picker muestra al navegar
 * "Compartido conmigo", donde Google organiza todo con shortcuts desde 2020)
 * tiene su propio id, pero ese id no tiene contenido descargable — hay que
 * resolverlo al id del archivo real (`shortcutDetails.targetId`) antes de
 * pedir `alt=media`, si no la Graph API lo trata como inexistente (404).
 */
async function resolverIdReal(
  driveFileId: string,
  accessToken: string
): Promise<{ id: string; error?: string }> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${driveFileId}` +
      "?fields=id,mimeType,shortcutDetails&supportsAllDrives=true",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    return { id: driveFileId, error: `Google Drive respondió ${res.status} al leer el archivo` };
  }
  const meta = await res.json();
  if (meta.mimeType === SHORTCUT_MIME_TYPE && meta.shortcutDetails?.targetId) {
    return { id: meta.shortcutDetails.targetId as string };
  }
  return { id: meta.id as string };
}

/**
 * Cliente real de Google Drive. El access token viene del Google Picker
 * (OAuth del lado del cliente, scope drive.file) — el servidor nunca lista ni
 * sincroniza el Drive, solo baja el archivo puntual que el usuario eligió.
 */
export const driveClient: DriveClient = {
  async descargarArchivo(driveFileId, accessToken) {
    const real = await resolverIdReal(driveFileId, accessToken);
    if (real.error) throw new Error(real.error);

    const res = await fetch(
      // supportsAllDrives=true: sin esto, Google Drive devuelve 404 al pedir
      // un archivo que vive en una Unidad compartida (Shared Drive) en vez de
      // "Mi unidad" — el Picker deja navegar y elegir esos archivos igual
      // (ver "Permitir navegar carpetas de Drive en el selector de archivos").
      `https://www.googleapis.com/drive/v3/files/${real.id}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) {
      throw new Error(`Google Drive respondió ${res.status} al descargar el archivo`);
    }
    const mimeType = res.headers.get("content-type") ?? "application/octet-stream";
    const data = Buffer.from(await res.arrayBuffer());
    return { data, mimeType };
  },
};
