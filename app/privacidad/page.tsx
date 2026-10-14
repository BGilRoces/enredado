import { PaginaLegal } from "@/components/pagina-legal";

export const metadata = { title: "Política de privacidad — enredado" };

export default function PrivacidadPage() {
  return (
    <PaginaLegal titulo="Política de privacidad">
      <p>Última actualización: octubre de 2026.</p>
      <h2 className="font-semibold text-zinc-900">Qué datos usamos</h2>
      <p>
        Cuando conectás tu cuenta de Google, enredado solicita acceso de <strong>solo lectura</strong> a tus
        archivos de Google Drive (permiso <code>drive.readonly</code>) únicamente para listar y descargar las
        fotos y videos que elegís publicar. Cuando conectás Instagram, usamos los permisos que autorizás para
        publicar contenido en esas cuentas.
      </p>
      <h2 className="font-semibold text-zinc-900">Cómo los usamos</h2>
      <p>
        Los archivos de Drive se descargan solo en el momento de publicar y se envían a Instagram. No los
        usamos para ningún otro fin, no los vendemos ni los compartimos con terceros, y no usamos tus datos
        para publicidad ni para entrenar modelos de IA.
      </p>
      <h2 className="font-semibold text-zinc-900">Qué guardamos</h2>
      <p>
        Guardamos, cifrados, los tokens de acceso necesarios para operar en tu nombre, y los metadatos de las
        publicaciones que programás (cuenta, links, textos y estado). No almacenamos copia de tus archivos de
        Drive.
      </p>
      <h2 className="font-semibold text-zinc-900">Cómo revocar el acceso</h2>
      <p>
        Podés desconectar Drive desde Configuración en el panel, o revocar el acceso en cualquier momento desde{" "}
        <a className="text-indigo-600" href="https://myaccount.google.com/permissions">
          myaccount.google.com/permissions
        </a>
        . Para pedir que eliminemos tus datos, escribinos a bautistagilroces@gmail.com.
      </p>
      <p>
        El uso de la información recibida de las APIs de Google cumple con la{" "}
        <a
          className="text-indigo-600"
          href="https://developers.google.com/terms/api-services-user-data-policy"
        >
          Política de datos de usuario de los Servicios de API de Google
        </a>
        , incluidos los requisitos de Uso Limitado.
      </p>
    </PaginaLegal>
  );
}
