"use client";

import { useEffect, useRef, useState } from "react";

// Google Identity Services no tiene tipos oficiales livianos; se accede como
// global cargado por script, ver loadScript() más abajo.
interface GoogleTokenClient {
  requestAccessToken(): void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            prompt?: string;
            callback: (response: { access_token: string; error?: string }) => void;
          }): GoogleTokenClient;
        };
      };
    };
  }
}

// drive.readonly (no drive.file): el picker propio (ver DrivePickerMobile,
// usado también en desktop) necesita poder listar carpetas (files.list),
// algo que drive.file no permite — ese scope solo da acceso a archivos que
// el usuario ya tocó explícitamente vía un Picker.
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

export interface ArchivoElegido {
  id: string;
  nombre: string;
  mimeType: string;
  accessToken: string;
  resourceKey?: string;
  /** Preview antes de subir — puede faltar (Drive no siempre la genera). */
  thumbnailUrl?: string;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    document.body.appendChild(script);
  });
}

/**
 * Encapsula el login OAuth de Google (Identity Services) y el picker de
 * archivos propio (ver drive-picker-mobile.tsx, usado tanto en mobile como
 * en desktop — el widget nativo de Google (DocsView) mostraba "No documents"
 * al navegar carpetas con archivos reales, un bug del lado de Google):
 * solo expone el archivo elegido. Nunca lista ni sincroniza el Drive del
 * usuario desde el servidor — el listado también corre en el browser, con
 * este mismo token.
 */
export function useGooglePicker() {
  const [archivos, setArchivos] = useState<ArchivoElegido[]>([]);
  const [error, setError] = useState<string | null>(null);
  const tokenClientRef = useRef<GoogleTokenClient | null>(null);
  const [pickerMobileAbierto, setPickerMobileAbierto] = useState(false);
  const [accessTokenPickerMobile, setAccessTokenPickerMobile] = useState<string | null>(null);

  useEffect(() => {
    loadScript("https://accounts.google.com/gsi/client").catch((err) => setError(err.message));
  }, []);

  function elegirDeDrive() {
    setError(null);
    if (!window.google) {
      setError("Todavía no cargó la librería de Google. Probá de nuevo en un segundo.");
      return;
    }
    if (!tokenClientRef.current) {
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
        scope: DRIVE_SCOPE,
        // Fuerza el selector de cuenta en cada login: el panel maneja varias
        // empresas y cada una puede tener su propio Google Drive, así que no
        // hay que quedar pegado silenciosamente a la última sesión del navegador.
        prompt: "select_account",
        callback: (tokenResponse) => {
          if (tokenResponse.error) {
            setError("Google no autorizó el acceso a Drive.");
            return;
          }
          setAccessTokenPickerMobile(tokenResponse.access_token);
          setPickerMobileAbierto(true);
        },
      });
    }
    tokenClientRef.current.requestAccessToken();
  }

  function quitarArchivo(id: string) {
    setArchivos((actuales) => actuales.filter((a) => a.id !== id));
  }

  /** El orden de `archivos` es el orden final del carousel (ver ADR-0011) — mueve uno un lugar hacia arriba/abajo. */
  function moverArchivo(id: string, direccion: -1 | 1) {
    setArchivos((actuales) => {
      const desde = actuales.findIndex((a) => a.id === id);
      const hasta = desde + direccion;
      if (desde === -1 || hasta < 0 || hasta >= actuales.length) return actuales;
      const copia = [...actuales];
      [copia[desde], copia[hasta]] = [copia[hasta], copia[desde]];
      return copia;
    });
  }

  /** Igual que moverArchivo, pero a una posición arbitraria — la usa el drag & drop. */
  function moverArchivoA(id: string, indiceDestino: number) {
    setArchivos((actuales) => {
      const desde = actuales.findIndex((a) => a.id === id);
      if (desde === -1) return actuales;
      const destino = Math.max(0, Math.min(indiceDestino, actuales.length - 1));
      if (desde === destino) return actuales;
      const copia = [...actuales];
      const [item] = copia.splice(desde, 1);
      copia.splice(destino, 0, item);
      return copia;
    });
  }

  function limpiarSeleccion() {
    setArchivos([]);
  }

  /** Reemplaza la selección anterior, igual que el callback del Picker de Google — reabrir arranca de cero. */
  function confirmarSeleccionMobile(elegidos: ArchivoElegido[]) {
    setArchivos(elegidos);
    setError(null);
    setPickerMobileAbierto(false);
    setAccessTokenPickerMobile(null);
  }

  function cerrarPickerMobile() {
    setPickerMobileAbierto(false);
    setAccessTokenPickerMobile(null);
  }

  return {
    archivos,
    elegirDeDrive,
    quitarArchivo,
    moverArchivo,
    moverArchivoA,
    limpiarSeleccion,
    error,
    pickerMobileAbierto,
    accessTokenPickerMobile,
    confirmarSeleccionMobile,
    cerrarPickerMobile,
  };
}
