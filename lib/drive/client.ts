import type { DriveClient } from "@/lib/publicador/types";

/**
 * Cliente real de Google Drive. El access token viene del Google Picker
 * (OAuth del lado del cliente, scope drive.file) — el servidor nunca lista ni
 * sincroniza el Drive, solo baja el archivo puntual que el usuario eligió.
 */
export const driveClient: DriveClient = {
  async descargarArchivo(driveFileId, accessToken) {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,
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
