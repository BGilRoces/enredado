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
  enableFeature(feature: unknown): GooglePickerBuilder;
  setOAuthToken(token: string): GooglePickerBuilder;
  setDeveloperKey(key: string): GooglePickerBuilder;
  setCallback(callback: (data: GooglePickerResponse) => void): GooglePickerBuilder;
  build(): { setVisible(visible: boolean): void };
}

interface GooglePickerDocsView {
  setIncludeFolders(include: boolean): GooglePickerDocsView;
  setSelectFolderEnabled(enabled: boolean): GooglePickerDocsView;
  setMimeTypes(mimeTypes: string): GooglePickerDocsView;
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
            prompt?: string;
            callback: (response: { access_token: string; error?: string }) => void;
          }): GoogleTokenClient;
        };
      };
      picker: {
        PickerBuilder: new () => GooglePickerBuilder;
        DocsView: new (viewId?: unknown) => GooglePickerDocsView;
        ViewId: { DOCS: unknown };
        Action: { PICKED: string };
        Feature: { MULTISELECT_ENABLED: unknown };
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
  const [archivos, setArchivos] = useState<ArchivoElegido[]>([]);
  const [error, setError] = useState<string | null>(null);
  const tokenClientRef = useRef<GoogleTokenClient | null>(null);
  // El próximo picker se abre en modo simple o múltiple según lo haya pedido
  // el caller de elegirDeDrive() — se guarda acá porque el callback de OAuth
  // (abrirPicker) se dispara async, después de que ya volvió elegirDeDrive().
  const multipleRef = useRef(false);

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
      // DocsView (en vez de ViewId.DOCS_IMAGES/DOCS_VIDEOS) muestra las
      // carpetas del Drive y permite navegarlas; los ViewId de tipo
      // "DOCS_*" listan los archivos sueltos que matchean, sin carpetas.
      const vistaImagenes = new google.picker.DocsView(google.picker.ViewId.DOCS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false)
        .setMimeTypes("image/png,image/jpeg,image/gif,image/webp");
      const vistaVideos = new google.picker.DocsView(google.picker.ViewId.DOCS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false)
        .setMimeTypes("video/mp4,video/quicktime,video/webm,video/x-m4v");
      let builder = new google.picker.PickerBuilder()
        .addView(vistaImagenes)
        .addView(vistaVideos)
        .setOAuthToken(accessToken)
        .setDeveloperKey(process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? "");
      if (multipleRef.current) {
        builder = builder.enableFeature(google.picker.Feature.MULTISELECT_ENABLED);
      }
      const picker = builder
        .setCallback((data: GooglePickerResponse) => {
          if (data.action !== google.picker.Action.PICKED) return;
          // Reemplaza la selección anterior: reabrir el Picker arranca de cero.
          setArchivos(
            data.docs.map((doc) => ({ id: doc.id, nombre: doc.name, mimeType: doc.mimeType, accessToken }))
          );
          setError(null);
        })
        .build();
      picker.setVisible(true);
    });
  }

  function elegirDeDrive(opts: { multiple: boolean } = { multiple: false }) {
    setError(null);
    multipleRef.current = opts.multiple;
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
          abrirPicker(tokenResponse.access_token);
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

  function limpiarSeleccion() {
    setArchivos([]);
  }

  return { archivos, elegirDeDrive, quitarArchivo, moverArchivo, limpiarSeleccion, error };
}
