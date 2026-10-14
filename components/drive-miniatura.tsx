"use client";

import { useState } from "react";

/** Miniatura de un archivo de Drive vía /api/drive/miniatura; si no hay (o falla), no ocupa lugar. */
export function DriveMiniatura({
  fileId,
  resourceKey,
  className = "h-14 w-14",
}: {
  fileId: string;
  resourceKey?: string | null;
  className?: string;
}) {
  const [fallo, setFallo] = useState(false);
  if (fallo) return null;

  const params = new URLSearchParams({ id: fileId });
  if (resourceKey) params.set("rk", resourceKey);

  return (
    // eslint-disable-next-line @next/next/no-img-element -- viene de Drive vía proxy propio, no de next/image
    <img
      src={`/api/drive/miniatura?${params}`}
      alt=""
      loading="lazy"
      className={`${className} shrink-0 rounded-md object-cover`}
      onError={() => setFallo(true)}
    />
  );
}
