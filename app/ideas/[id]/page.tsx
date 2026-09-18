import { notFound, redirect } from "next/navigation";
import { EstadoIdea, TipoPublicacion } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { asegurarAccesoACuenta } from "@/lib/auth/cuenta-permitida";
import { esAtrasada } from "@/lib/ideas/es-atrasada";
import { mensajeDeError } from "@/lib/mensaje-de-error";
import { claseBadgeEstadoIdea, etiquetaEstadoIdea } from "@/components/etiqueta-estado-idea";
import { claseBadgeEstado, etiquetaEstado } from "@/components/etiqueta-estado";
import { AppShell } from "@/components/app-shell";
import { CarpetaIdeaArchivos } from "@/components/carpeta-idea-archivos";
import {
  actualizarIdea,
  calendarizarIdea,
  cambiarEstadoIdea,
  descalendarizarIdea,
  eliminarIdea,
  marcarEnDrive,
} from "../actions";

export const dynamic = "force-dynamic";

const INPUT_CLASS =
  "rounded-lg border border-zinc-300 p-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

const ESTADOS_MANUALES = [EstadoIdea.idea, EstadoIdea.guionada, EstadoIdea.grabada] as const;
const ETIQUETA_ESTADO_MANUAL: Record<(typeof ESTADOS_MANUALES)[number], string> = {
  idea: "Idea",
  guionada: "Guionada",
  grabada: "Grabada",
};

function aInputDatetimeLocal(fecha: Date | null): string {
  return fecha ? fecha.toISOString().slice(0, 16) : "";
}

/**
 * Estas acciones corren desde un <form> plano, sin JS de cliente que pueda
 * atrapar un throw y mostrarlo lindo — sin esto, cualquier error de
 * validación (ej. un link de Drive con formato raro) crashea toda la página
 * en vez de mostrar el mensaje. redirect() dentro del catch nunca se atrapa
 * a sí mismo, así que es seguro.
 *
 * Tiene que vivir a nivel de módulo, no adentro de IdeaPage: una Server
 * Action inline sólo puede cerrar sobre datos serializables de su clausura
 * (ver "use server" de Next.js) — cerrar sobre una función común (no
 * marcada "use server") definida en el cuerpo del componente rompe TODAS las
 * acciones que la referencian, con el error "Functions cannot be passed
 * directly to Client Components" (encontrado en los logs de producción).
 */
async function conManejoDeError(id: string, accion: () => Promise<void>): Promise<void> {
  try {
    await accion();
  } catch (err) {
    redirect(`/ideas/${id}?error=${encodeURIComponent(mensajeDeError(err))}`);
  }
}

export default async function IdeaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const idea = await prisma.idea.findUnique({
    where: { id },
    include: {
      cuenta: true,
      publicaciones: { orderBy: { creadaEn: "asc" } },
      archivos: { orderBy: { orden: "asc" } },
    },
  });
  if (!idea) notFound();
  await asegurarAccesoACuenta(idea.cuentaId);

  const promocionada = idea.publicaciones.length > 0;
  const atrasada = esAtrasada(new Date(), { ...idea, yaPromocionada: promocionada });

  async function guardar(formData: FormData) {
    "use server";
    await conManejoDeError(id, () =>
      actualizarIdea(id, {
        titulo: String(formData.get("titulo") ?? ""),
        descripcion: String(formData.get("descripcion") ?? ""),
        guion: String(formData.get("guion") ?? ""),
        linkReferencia1: String(formData.get("linkReferencia1") ?? ""),
        linkReferencia2: String(formData.get("linkReferencia2") ?? ""),
        caption: String(formData.get("caption") ?? ""),
      })
    );
  }

  async function guardarDrive(formData: FormData) {
    "use server";
    await conManejoDeError(id, () => marcarEnDrive(id, String(formData.get("driveLink") ?? "")));
  }

  async function guardarCalendario(formData: FormData) {
    "use server";
    const valor = String(formData.get("programadaPara") ?? "");
    await conManejoDeError(id, () =>
      valor ? calendarizarIdea(id, new Date(valor)) : descalendarizarIdea(id)
    );
  }

  async function borrar() {
    "use server";
    // El redirect de éxito queda fuera del try/catch a propósito: redirect()
    // funciona tirando una excepción especial de Next.js, que un catch
    // genérico atraparía como si fuera un error real.
    try {
      await eliminarIdea(id);
    } catch (err) {
      redirect(`/ideas/${id}?error=${encodeURIComponent(mensajeDeError(err))}`);
    }
    redirect("/ideas");
  }

  return (
    <AppShell active="ideas">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">{idea.titulo}</h1>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${claseBadgeEstadoIdea(idea)}`}>
          {etiquetaEstadoIdea(idea)}
        </span>
      </div>
      <p className="text-sm text-zinc-500">
        {idea.cuenta.nombre} · {idea.tipo}
      </p>
      {typeof error === "string" && (
        <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>
      )}
      {atrasada && (
        <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          Atrasada: la hora programada ya pasó y esta idea todavía no está &quot;en Drive&quot;, así que no se
          publicó sola.
        </p>
      )}

      {promocionada && (
        <div className="flex flex-col gap-2 rounded-lg bg-sky-50 p-3 text-sm text-sky-700">
          <p>
            Ya se promocionó a {idea.publicaciones.length === 1 ? "una Publicación real" : `${idea.publicaciones.length} Publicaciones reales`}{" "}
            — el título/guión/links siguen editables como notas, pero el tipo y el/los archivo(s) ya no se pueden
            cambiar acá.
          </p>
          {idea.publicaciones.length > 1 && (
            <ul className="flex flex-col gap-1">
              {idea.publicaciones.map((publicacion, i) => (
                <li key={publicacion.id} className="flex items-center gap-2">
                  <span className="text-xs text-sky-600">#{i + 1}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${claseBadgeEstado(publicacion)}`}>
                    {etiquetaEstado(publicacion)}
                  </span>
                  {publicacion.error && <span className="text-xs text-rose-700">{publicacion.error}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!promocionada && (
        <div className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-zinc-700">Estado</p>
          <div className="flex flex-wrap gap-2">
            {ESTADOS_MANUALES.map((estado) => (
              <form
                key={estado}
                action={async () => {
                  "use server";
                  await conManejoDeError(id, () => cambiarEstadoIdea(id, estado));
                }}
              >
                <button
                  type="submit"
                  disabled={idea.estado === estado}
                  className={
                    idea.estado === estado
                      ? "rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white"
                      : "rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                  }
                >
                  {ETIQUETA_ESTADO_MANUAL[estado]}
                </button>
              </form>
            ))}
          </div>

          <form action={guardarDrive} className="mt-2 flex flex-col gap-2">
            <label className="text-sm font-medium text-zinc-700">Link de Drive (marca &quot;en Drive&quot;)</label>
            <p className="text-xs text-zinc-500">
              {idea.tipo === TipoPublicacion.reel
                ? "Un Reel es un solo video: pegá el link del archivo puntual (\"Compartir\" → \"Copiar enlace\"), no el de una carpeta."
                : idea.tipo === TipoPublicacion.post
                  ? "El link de un archivo puntual, o el de una carpeta entera para armar un carousel (hasta 10 elementos, orden elegible abajo)."
                  : "El link de un archivo puntual, o el de una carpeta entera para subir varias Historias seguidas (orden elegible abajo)."}
            </p>
            <div className="flex gap-2">
              <input
                name="driveLink"
                defaultValue={idea.driveLink ?? ""}
                placeholder="https://drive.google.com/file/d/... o /drive/folders/..."
                className={`${INPUT_CLASS} flex-1`}
              />
              <button
                type="submit"
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-zinc-50"
              >
                Guardar
              </button>
            </div>
          </form>

          {idea.archivos.length > 0 && (
            <CarpetaIdeaArchivos ideaId={id} archivosIniciales={idea.archivos} />
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-medium text-zinc-700">Calendario</p>
        <form action={guardarCalendario} className="flex flex-col gap-2">
          <input
            type="datetime-local"
            name="programadaPara"
            defaultValue={aInputDatetimeLocal(idea.programadaPara)}
            className={INPUT_CLASS}
          />
          <span className="text-xs text-zinc-500">
            Hora UTC. {idea.estado === EstadoIdea.enDrive
              ? "Al llegar la hora se publica sola."
              : 'Recordatorio no más: recién dispara si para esa hora ya está "en Drive".'}{" "}
            Dejá vacío y guardá para descalendarizar.
          </span>
          <button
            type="submit"
            className="self-start rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-zinc-50"
          >
            Guardar fecha
          </button>
        </form>
      </div>

      <form action={guardar} className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-medium text-zinc-700">Notas</p>
        <input name="titulo" required defaultValue={idea.titulo} placeholder="Título" className={INPUT_CLASS} />
        <textarea
          name="descripcion"
          defaultValue={idea.descripcion ?? ""}
          placeholder="Mini-descripción"
          rows={2}
          className={INPUT_CLASS}
        />
        <textarea name="guion" defaultValue={idea.guion ?? ""} placeholder="Guión" rows={8} className={INPUT_CLASS} />
        <input
          name="linkReferencia1"
          defaultValue={idea.linkReferencia1 ?? ""}
          placeholder="Link de referencia 1"
          className={INPUT_CLASS}
        />
        <input
          name="linkReferencia2"
          defaultValue={idea.linkReferencia2 ?? ""}
          placeholder="Link de referencia 2"
          className={INPUT_CLASS}
        />
        <label className="text-sm font-medium text-zinc-700">
          Caption (lo que sale de verdad en el post)
        </label>
        <textarea name="caption" defaultValue={idea.caption ?? ""} rows={2} className={INPUT_CLASS} />
        <button
          type="submit"
          className="self-start rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
        >
          Guardar cambios
        </button>
      </form>

      <form action={borrar}>
        <button
          type="submit"
          className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm text-rose-700 transition-colors hover:bg-rose-50"
        >
          Eliminar idea
        </button>
      </form>
    </AppShell>
  );
}
