export interface DriveLinkParseado {
  driveFileId: string;
  resourceKey?: string;
}

const PATRON_PATH = /\/file\/d\/([^/]+)/;

/**
 * Extrae el driveFileId (y el resourceKey, si el link lo trae — Drive lo
 * exige desde 2021 para archivos compartidos por link, ver lib/drive/client.ts)
 * de las formas de URL que Drive genera al compartir un archivo:
 * `.../file/d/<id>/view?...`, `.../open?id=<id>`, `.../uc?id=<id>`.
 *
 * Devuelve `null` si no reconoce ninguna forma — se usa para validar lo que
 * el usuario pega en "marcar en Drive" (ver app/ideas/actions.ts).
 */
export function parsearDriveLink(link: string): DriveLinkParseado | null {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }

  const resourceKey = url.searchParams.get("resourcekey") ?? undefined;

  const porPath = url.pathname.match(PATRON_PATH);
  if (porPath) {
    return { driveFileId: porPath[1], resourceKey };
  }

  const porQuery = url.searchParams.get("id");
  if (porQuery) {
    return { driveFileId: porQuery, resourceKey };
  }

  return null;
}
