import { PaginaLegal } from "@/components/pagina-legal";

export const metadata = { title: "Acerca de enredado" };

export default function AcercaPage() {
  return (
    <PaginaLegal titulo="enredado">
      <p>
        enredado es un panel de uso privado para gestionar varias cuentas de Instagram: permite elegir fotos y
        videos desde Google Drive y programarlos como posts, historias o reels en la cuenta que corresponda.
      </p>
      <p>
        Para eso se conecta, con tu autorización, a tu cuenta de Google (acceso de solo lectura a Drive) y a tus
        cuentas de Instagram.
      </p>
      <p>
        <a href="/login" className="text-indigo-600">
          Iniciar sesión
        </a>
      </p>
    </PaginaLegal>
  );
}
