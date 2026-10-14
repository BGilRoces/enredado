import { PaginaLegal } from "@/components/pagina-legal";

export const metadata = { title: "Condiciones del servicio — enredado" };

export default function TerminosPage() {
  return (
    <PaginaLegal titulo="Condiciones del servicio">
      <p>Última actualización: octubre de 2026.</p>
      <p>
        enredado es una herramienta de uso privado para gestionar y programar publicaciones en cuentas de
        Instagram propias o sobre las que tenés autorización. El acceso es solo para usuarios habilitados.
      </p>
      <p>
        Sos responsable del contenido que publicás y de contar con los derechos sobre él, y de cumplir las
        condiciones de Instagram/Meta y de Google. No debés usar el servicio para publicar contenido ilegal o
        que infrinja derechos de terceros.
      </p>
      <p>
        El servicio se ofrece &quot;tal cual&quot;, sin garantías de disponibilidad; podemos modificarlo o
        suspenderlo en cualquier momento. Podés dejar de usarlo y revocar los accesos cuando quieras (ver la{" "}
        <a className="text-indigo-600" href="/privacidad">
          Política de privacidad
        </a>
        ).
      </p>
      <p>Consultas: bautistagilroces@gmail.com.</p>
    </PaginaLegal>
  );
}
