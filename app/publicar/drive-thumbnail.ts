/**
 * Las URLs de miniatura de Drive (tanto `doc.thumbnails[].url`/`doc.iconUrl`
 * que da el Picker de Google como `thumbnailLink` de la Drive API) no cargan
 * de forma confiable como `<img src>` plano: dependen de que el navegador
 * tenga la cookie de sesión de la cuenta de Google correcta, algo cada vez
 * más bloqueado (Safari ITP, cookies de terceros) — por eso el preview "no
 * carga en ningún lado", en desktop y en mobile por igual. La bajan acá con
 * el mismo access token que cualquier otro pedido a Drive y la convierten a
 * data URL, que no depende de cookies ni hay que revocar (a diferencia de un
 * blob: URL).
 */
export async function bajarThumbnail(
  url: string,
  accessToken: string,
  signal?: AbortSignal
): Promise<string | undefined> {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, signal });
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
