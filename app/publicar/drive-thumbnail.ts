/**
 * Por qué esto NO usa `thumbnailLink` ni `doc.thumbnails`/`doc.iconUrl` del
 * Picker (el intento anterior):
 *
 * - El Picker de Google directamente no devuelve `thumbnails` para items que
 *   pertenecen a Google Drive — está documentado así ("Thumbnails aren't
 *   returned if the selected items belong to Google Drive"), no es un bug.
 * - `thumbnailLink` de la Drive API sí existe, pero Google mismo advierte
 *   que "no está pensado para usarse directo desde una web" por CORS, y
 *   recomienda un proxy de servidor — fetch() con el access token en el
 *   header falla ahí (lo que pasó en el primer intento).
 *
 * Lo único que sí tiene CORS habilitado para pedidos autenticados desde el
 * browser es la propia Drive API REST (`www.googleapis.com/drive/v3/...`) —
 * ya comprobado porque `files.list` (el listado de carpetas del picker
 * mobile) anda así. Por eso esto baja el archivo real con `alt=media` en vez
 * de una miniatura — más pesado, pero el único camino confiable sin agregar
 * un proxy propio. Por eso mismo solo se llama para imágenes, nunca para
 * video (bajaría el archivo entero).
 */
export async function bajarImagenComoDataUrl(
  fileId: string,
  accessToken: string,
  resourceKey?: string,
  signal?: AbortSignal
): Promise<string | undefined> {
  try {
    const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
    if (resourceKey) headers["X-Goog-Drive-Resource-Keys"] = `${fileId}/${resourceKey}`;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, {
      headers,
      signal,
    });
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}
