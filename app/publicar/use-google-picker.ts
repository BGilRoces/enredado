"use client";

import { useEffect, useRef, useState } from "react";

// Google Identity Services y el Picker no tienen tipos oficiales livianos;
// se acceden como globals cargados por script, ver loadScript() más abajo.
interface GooglePickerDoc {
  id: string;
  name: string;
  mimeType: string;
}

interface GooglePickerResponse {
  action: string;
  docs: GooglePickerDoc[];
}

interface GooglePickerBuilder {
  addView(view: unknown): GooglePickerBuilder;
  setOAuthToken(token: string): GooglePickerBuilder;
  setDeveloperKey(key: string): GooglePickerBuilder;
  setCallback(callback: (data: GooglePickerResponse) => void): GooglePickerBuilder;
  build(): { setVisible(visible: boolean): void };
}

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
            callback: (response: { access_token: string; error?: string }) => void;
          }): GoogleTokenClient;
        };
      };
      picker: {
        PickerBuilder: new () => GooglePickerBuilder;
        ViewId: { DOCS_IMAGES: unknown };
        Action: { PICKED: string };
      };
    };
    gapi?: {
      load(api: string, callback: () => void): void;
    };
  }
}

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export interface ArchivoElegido {
  id: string;
  nombre: string;
  mimeType: string;
  accessToken: string;
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
 * Encapsula el login OAuth de Google (Identity Services) y el Picker: solo
 * expone el archivo elegido, sin listar ni sincronizar el Drive del usuario.
 */
export function useGooglePicker() {
  const [archivo, setArchivo] = useState<ArchivoElegido | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tokenClientRef = useRef<GoogleTokenClient | null>(null);

  useEffect(() => {
    Promise.all([
      loadScript("https://accounts.google.com/gsi/client"),
      loadScript("https://apis.google.com/js/api.js"),
    ]).catch((err) => setError(err.message));
  }, []);

  function abrirPicker(accessToken: string) {
    if (!window.gapi || !window.google) return;
    const { google } = window;
    window.gapi.load("picker", () => {
      const picker = new google.picker.PickerBuilder()
        .addView(google.picker.ViewId.DOCS_IMAGES)
        .setOAuthToken(accessToken)
        .setDeveloperKey(process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? "")
        .setCallback((data: GooglePickerResponse) => {
          if (data.action !== google.picker.Action.PICKED) return;
          const doc = data.docs[0];
          setArchivo({ id: doc.id, nombre: doc.name, mimeType: doc.mimeType, accessToken });
          setError(null);
        })
        .build();
      picker.setVisible(true);
    });
  }

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
        callback: (tokenResponse) => {
          if (tokenResponse.error) {
            setError("Google no autorizó el acceso a Drive.");
            return;
          }
          abrirPicker(tokenResponse.access_token);
        },
      });
    }
    tokenClientRef.current.requestAccessToken();
  }

  return { archivo, elegirDeDrive, error };
}
