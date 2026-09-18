export interface ArchivoDeCarpeta {
  id: string;
  nombre: string;
  mimeType: string;
  resourceKey?: string;
}

/**
 * Lista el contenido de primer nivel de una carpeta de Drive (ver ADR-0016)
 * — no baja los archivos, sólo su metadata, para que el usuario elija el
 * orden en el panel antes de calendarizar. Usa el access token del servidor
 * (ver lib/drive-oauth/mint-access-token.ts), no el del Picker interactivo:
 * a diferencia de descargar un archivo puntual, listar una carpeta sólo
 * tiene sentido acá, donde no hay una sesión de navegador abierta.
 */
export async function listarArchivosDeCarpeta(
  folderId: string,
  accessToken: string
): Promise<ArchivoDeCarpeta[]> {
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", `'${folderId}' in parents and trashed = false`);
  url.searchParams.set("fields", "files(id,name,mimeType,resourceKey)");
  url.searchParams.set("orderBy", "name");
  url.searchParams.set("pageSize", "100");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("includeItemsFromAllDrives", "true");

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const cuerpo = await res.text();
    let detalle: string;
    try {
      detalle = JSON.parse(cuerpo)?.error?.message ?? cuerpo;
    } catch {
      detalle = cuerpo;
    }
    throw new Error(`Google Drive respondió ${res.status} al listar la carpeta${detalle ? `: ${detalle}` : ""}`);
  }

  const body = await res.json();
  const archivos = (body.files ?? []) as { id: string; name: string; mimeType: string; resourceKey?: string }[];
  return archivos.map((a) => ({ id: a.id, nombre: a.name, mimeType: a.mimeType, resourceKey: a.resourceKey }));
}
