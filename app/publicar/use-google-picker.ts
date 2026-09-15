"use client";

import { useEffect, useRef, useState } from "react";
import { bajarImagenComoDataUrl } from "./drive-thumbnail";

// Google Identity Services y el Picker no tienen tipos oficiales livianos;
// se acceden como globals cargados por script, ver loadScript() más abajo.
interface GooglePickerDoc {
  id: string;
  name: string;
  mimeType: string;
  /** Presente cuando el archivo se compartió por link (no directo con la cuenta) — Drive lo exige para poder leerlo. */
  resourceKey?: string;
  /** Preview chica que sirve la sesión de Google del navegador — sin esto no hay miniatura para algunos videos. */
  iconUrl?: string;
  thumbnails?: { url: string }[];
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
  setAppId(appId: string): GooglePickerBuilder;
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

// drive.readonly (no drive.file): el picker propio de mobile necesita poder
// listar carpetas (files.list), algo que drive.file no permite — ese scope
// solo da acceso a archivos que el usuario ya tocó explícitamente vía un
// Picker. Ver "Selector de Drive propio para mobile".
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

/** Input táctil primario — más confiable que el ancho de pantalla, que un desktop con la ventana angosta puede falsear. */
function esMobile(): boolean {
  return window.matchMedia("(pointer: coarse)").matches;
}

/**
 * Google exige setAppId() (el número de proyecto de Cloud) para que el
 * scope drive.file otorgue acceso real al archivo elegido — sin esto, la
 * Drive API trata cualquier archivo elegido por el Picker como inexistente
 * (404 "File not found"), incluso siendo el dueño. El número de proyecto es
 * el prefijo numérico del propio Client ID (antes del primer guion), así que
 * no hace falta pedir un dato nuevo.
 */
function numeroDeProyecto(clientId: string): string {
  return clientId.split("-")[0];
}

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
 * archivos (el widget de Google en desktop, uno propio en mobile — ver
 * drive-picker-mobile.tsx): solo expone el archivo elegido. Nunca lista ni
 * sincroniza el Drive del usuario desde el servidor — el listado del picker
 * mobile también corre en el browser, con este mismo token.
 */
export function useGooglePicker() {
  const [archivos, setArchivos] = useState<ArchivoElegido[]>([]);
  const [error, setError] = useState<string | null>(null);
  const tokenClientRef = useRef<GoogleTokenClient | null>(null);
  // El próximo picker se abre en modo simple o múltiple según lo haya pedido
  // el caller de elegirDeDrive() — se guarda acá porque el callback de OAuth
  // (abrirPicker) se dispara async, después de que ya volvió elegirDeDrive().
  const multipleRef = useRef(false);
  // Copia en estado de multipleRef: el modal del picker mobile es un
  // componente React normal y necesita re-renderizar con este valor, a
  // diferencia del Picker de Google que lo lee una sola vez al abrirse.
  const [multiple, setMultiple] = useState(false);
  const [pickerMobileAbierto, setPickerMobileAbierto] = useState(false);
  const [accessTokenPickerMobile, setAccessTokenPickerMobile] = useState<string | null>(null);

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
        .setDeveloperKey(process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? "")
        .setAppId(numeroDeProyecto(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ""));
      if (multipleRef.current) {
        builder = builder.enableFeature(google.picker.Feature.MULTISELECT_ENABLED);
      }
      const picker = builder
        .setCallback((data: GooglePickerResponse) => {
          if (data.action !== google.picker.Action.PICKED) return;
          // Reemplaza la selección anterior: reabrir el Picker arranca de cero.
          setArchivos(
            data.docs.map((doc) => ({
              id: doc.id,
              nombre: doc.name,
              mimeType: doc.mimeType,
              accessToken,
              resourceKey: doc.resourceKey,
            }))
          );
          setError(null);
          // El Picker no devuelve `thumbnails` para items de Google Drive (es
          // así por diseño, no un bug — ver drive-thumbnail.ts) — se bajan
          // aparte con la Drive API y se suman a cada archivo cuando llegan,
          // sin bloquear que la lista aparezca. Solo para imágenes: para
          // video bajaría el archivo entero.
          Promise.all(
            data.docs
              .filter((doc) => doc.mimeType.startsWith("image/"))
              .map(async (doc) => {
                const thumbnailUrl = await bajarImagenComoDataUrl(doc.id, accessToken, doc.resourceKey);
                return thumbnailUrl ? { id: doc.id, thumbnailUrl } : null;
              })
          ).then((resultados) => {
            setArchivos((actuales) =>
              actuales.map((a) => {
                const resultado = resultados.find((r) => r?.id === a.id);
                return resultado ? { ...a, thumbnailUrl: resultado.thumbnailUrl } : a;
              })
            );
          });
        })
        .build();
      // El Picker centra su diálogo según el scroll de la página en el
      // momento de mostrarse. Si el usuario tocó el botón estando scrolleado
      // hacia abajo (común en mobile, donde la página es más larga), el
      // diálogo queda posicionado arriba del todo del documento, fuera de la
      // vista actual — hay que subir el scroll antes de abrirlo.
      window.scrollTo({ top: 0, behavior: "instant" });
      picker.setVisible(true);
    });
  }

  function elegirDeDrive(opts: { multiple: boolean } = { multiple: false }) {
    setError(null);
    multipleRef.current = opts.multiple;
    setMultiple(opts.multiple);
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
          // El widget de Google (PickerBuilder) depende de hover para
          // navegar carpetas y de checkboxes chicos para multi-seleccionar
          // — en touch no anda. En mobile se abre el picker propio en su
          // lugar (ver drive-picker-mobile.tsx).
          if (esMobile()) {
            setAccessTokenPickerMobile(tokenResponse.access_token);
            setPickerMobileAbierto(true);
          } else {
            abrirPicker(tokenResponse.access_token);
          }
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
    multiple,
    pickerMobileAbierto,
    accessTokenPickerMobile,
    confirmarSeleccionMobile,
    cerrarPickerMobile,
  };
}
