"use client";

import { useState } from "react";
import { DrivePickerMobile } from "@/app/publicar/drive-picker-mobile";
import { useGooglePicker } from "@/app/publicar/use-google-picker";

const INPUT_CLASS =
  "rounded-lg border border-zinc-300 p-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

/**
 * Campo "driveLink" de una Idea (lo lee la Server Action del <form> que lo
 * envuelve, ver app/ideas/[id]/page.tsx): se puede pegar el link a mano o
 * "Examinar" Drive con el mismo picker de /publicar. Examinar sólo rellena el
 * input — guardar sigue siendo el botón del form, que valida y lista la
 * carpeta del lado del servidor (ver marcarEnDrive).
 */
export function DriveLinkIdeaInput({
  defaultValue,
  permitirCarpeta,
}: {
  defaultValue: string;
  /** Un Reel es un solo video, no admite carpeta (ver ADR-0016). */
  permitirCarpeta: boolean;
}) {
  const [link, setLink] = useState(defaultValue);
  const {
    elegirDeDrive,
    error,
    pickerMobileAbierto,
    accessTokenPickerMobile,
    confirmarSeleccionMobile,
    confirmarCarpetaMobile,
    cerrarPickerMobile,
  } = useGooglePicker();

  return (
    <>
      <div className="flex min-w-0 flex-1 basis-full gap-2 sm:basis-auto">
        <input
          name="driveLink"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://drive.google.com/file/d/... o /drive/folders/..."
          className={`${INPUT_CLASS} min-w-0 flex-1`}
        />
        <button
          type="button"
          onClick={elegirDeDrive}
          className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-zinc-50"
        >
          Examinar Drive
        </button>
      </div>
      {error && <p className="w-full text-xs text-rose-700">{error}</p>}

      {pickerMobileAbierto && accessTokenPickerMobile && (
        <DrivePickerMobile
          accessToken={accessTokenPickerMobile}
          multiple={false}
          onConfirm={([archivo]) => {
            const resourceKey = archivo.resourceKey ? `?resourcekey=${encodeURIComponent(archivo.resourceKey)}` : "";
            setLink(`https://drive.google.com/file/d/${archivo.id}/view${resourceKey}`);
            confirmarSeleccionMobile([archivo]);
          }}
          onConfirmCarpeta={
            permitirCarpeta
              ? (carpeta) => {
                  setLink(`https://drive.google.com/drive/folders/${carpeta.id}`);
                  confirmarCarpetaMobile();
                }
              : undefined
          }
          onClose={cerrarPickerMobile}
        />
      )}
    </>
  );
}
