import type { ArchivoDeCarpeta } from "@/lib/drive/listar-carpeta";

/**
 * Metadata (nombre, tipo) de un archivo puntual de Drive, para mostrarlo en
 * la selección antes de publicar cuando el usuario pegó el link a mano en vez
 * de elegirlo con el Picker. No baja el contenido.
 */
export async function obtenerArchivoDeDrive(
  fileId: string,
  accessToken: string,
  resourceKey?: string
): Promise<ArchivoDeCarpeta> {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`);
  url.searchParams.set("fields", "id,name,mimeType,resourceKey");
  url.searchParams.set("supportsAllDrives", "true");

  const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
  if (resourceKey) headers["X-Goog-Drive-Resource-Keys"] = `${fileId}/${resourceKey}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? "No se encontró ese archivo en Drive — revisá el link y que tu cuenta de Google conectada tenga acceso."
        : `Google Drive respondió ${res.status} al leer el archivo.`
    );
  }
  const body = (await res.json()) as { id: string; name: string; mimeType: string; resourceKey?: string };
  return { id: body.id, nombre: body.name, mimeType: body.mimeType, resourceKey: body.resourceKey ?? resourceKey };
}
