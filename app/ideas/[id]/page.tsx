import { notFound, redirect } from "next/navigation";
import { EstadoIdea, TipoPublicacion } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { aInputDatetimeLocal, claveDiaLocal, desdeHoraLocal } from "@/lib/zona-horaria";
import { asegurarAccesoACuenta } from "@/lib/auth/cuenta-permitida";
import { esAtrasada } from "@/lib/ideas/es-atrasada";
import { mensajeDeError } from "@/lib/mensaje-de-error";
import { claseBadgeEstadoIdea, etiquetaEstadoIdea, faltaProgramarEnIg } from "@/components/etiqueta-estado-idea";
import { AppShell } from "@/components/app-shell";
import { CarpetaIdeaArchivos } from "@/components/carpeta-idea-archivos";
import { DriveMiniatura } from "@/components/drive-miniatura";
import { DriveLinkIdeaInput } from "@/components/drive-link-idea-input";
import { SubmitButton } from "@/components/submit-button";
import {
  actualizarIdea,
  calendarizarIdea,
  cambiarEstadoIdea,
  descalendarizarIdea,
  eliminarIdea,
  marcarEnDrive,
  marcarProgramadaEnIg,
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
      cuenta: { include: { productos: { orderBy: { nombre: "asc" } } } },
      producto: true,
      publicaciones: { orderBy: { creadaEn: "asc" } },
      archivos: { orderBy: { orden: "asc" } },
    },
  });
  if (!idea) notFound();
  await asegurarAccesoACuenta(idea.cuentaId);

  // Sólo lo que el panel publicó antes de ADR-0020 congela la Idea.
  const promocionada = idea.publicaciones.some((p) => p.estado === "publicada");
  const faltaProgramar = faltaProgramarEnIg(idea);
  const marcarComoProgramada = idea.programadaEnIgEl === null;
  const atrasada = esAtrasada(new Date(), { ...idea, yaPromocionada: promocionada });

  async function guardar(formData: FormData) {
    "use server";
    // El redirect de éxito queda fuera del try/catch a propósito (ver borrar
    // más abajo): redirect() tira una excepción especial que un catch
    // genérico atraparía como si fuera un error real.
    try {
      await actualizarIdea(id, {
        productoId: String(formData.get("productoId") ?? "") || null,
        titulo: String(formData.get("titulo") ?? ""),
        descripcion: String(formData.get("descripcion") ?? ""),
        guion: String(formData.get("guion") ?? ""),
        linkReferencia1: String(formData.get("linkReferencia1") ?? ""),
        linkReferencia2: String(formData.get("linkReferencia2") ?? ""),
        caption: String(formData.get("caption") ?? ""),
        audio: String(formData.get("audio") ?? ""),
      });
    } catch (err) {
      redirect(`/ideas/${id}?error=${encodeURIComponent(mensajeDeError(err))}`);
    }
    redirect("/ideas");
  }

  async function guardarDrive(formData: FormData) {
    "use server";
    await conManejoDeError(id, () => marcarEnDrive(id, String(formData.get("driveLink") ?? "")));
  }

  async function guardarCalendario(formData: FormData) {
    "use server";
    const valor = String(formData.get("programadaPara") ?? "");
    await conManejoDeError(id, () =>
      valor ? calendarizarIdea(id, desdeHoraLocal(valor)) : descalendarizarIdea(id)
    );
  }

  async function alternarProgramadaEnIg() {
    "use server";
    await conManejoDeError(id, () => marcarProgramadaEnIg(id, marcarComoProgramada));
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
        {idea.cuenta.nombre} · {idea.producto?.nombre ?? "General"} · {idea.tipo}
      </p>
      {typeof error === "string" && (
        <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>
      )}
      {atrasada && (
        <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {idea.estado === "enDrive"
            ? "Atrasada: la hora ya pasó y no la marcaste como programada en Instagram. Reprogramala o marcala si ya salió."
            : "Atrasada: la hora ya pasó y esta idea todavía no está \"en Drive\"."}
        </p>
      )}

      {(idea.estado === "enDrive" && idea.programadaPara) && (
        <div
          className={`flex flex-col gap-2 rounded-2xl border p-4 ${
            faltaProgramar ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50"
          }`}
        >
          <p className={`text-sm font-medium ${faltaProgramar ? "text-rose-800" : "text-emerald-800"}`}>
            {faltaProgramar
              ? "Falta programarla en Instagram"
              : `Programada en Instagram (marcada el ${claveDiaLocal(idea.programadaEnIgEl!)})`}
          </p>
          <p className="text-xs text-zinc-600">
            El panel no publica solo: abrí la app de Instagram, subí el archivo, elegí el audio, pegá el caption y
            programala para la fecha de abajo. Después marcala acá.
          </p>
          <form action={alternarProgramadaEnIg}>
            <SubmitButton
              pendingText="Guardando…"
              className={
                faltaProgramar
                  ? "rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
                  : "rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-white"
              }
            >
              {faltaProgramar ? "Ya la programé en Instagram" : "Desmarcar"}
            </SubmitButton>
          </form>
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
                <SubmitButton
                  disabled={idea.estado === estado}
                  className={
                    idea.estado === estado
                      ? "rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white"
                      : "rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                  }
                >
                  {ETIQUETA_ESTADO_MANUAL[estado]}
                </SubmitButton>
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
            <div className="flex flex-wrap gap-2">
              <DriveLinkIdeaInput
                defaultValue={idea.driveLink ?? ""}
                permitirCarpeta={idea.tipo !== TipoPublicacion.reel}
              />
              <SubmitButton
                pendingText="Guardando…"
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-zinc-50"
              >
                Guardar
              </SubmitButton>
            </div>
          </form>

          {idea.driveFileId && idea.archivos.length === 0 && (
            <DriveMiniatura fileId={idea.driveFileId} resourceKey={idea.driveResourceKey} className="mt-2 h-32 w-32" />
          )}

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
            Hora de Argentina (UTC-3). Es la fecha en la que va a salir en Instagram; el panel no publica solo.{" "}
            Si la cambiás, se desmarca como programada en IG. Dejá vacío y guardá para descalendarizar.
          </span>
          <SubmitButton
            pendingText="Guardando…"
            className="self-start rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-zinc-50"
          >
            Guardar fecha
          </SubmitButton>
        </form>
      </div>

      <form action={guardar} className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-medium text-zinc-700">Notas</p>
        {idea.cuenta.productos.length > 0 && (
          <>
            <label className="text-sm font-medium text-zinc-700">Producto</label>
            <select name="productoId" defaultValue={idea.productoId ?? ""} className={INPUT_CLASS}>
              <option value="">General (marca)</option>
              {idea.cuenta.productos.map((producto) => (
                <option key={producto.id} value={producto.id}>
                  {producto.nombre}
                </option>
              ))}
            </select>
          </>
        )}
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
        <label className="text-sm font-medium text-zinc-700">Audio de Instagram (canción – artista)</label>
        <input name="audio" defaultValue={idea.audio ?? ""} placeholder="Opcional" className={INPUT_CLASS} />
        <SubmitButton
          pendingText="Guardando…"
          className="self-start rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
        >
          Guardar cambios
        </SubmitButton>
      </form>

      <form action={borrar}>
        <SubmitButton
          pendingText="Eliminando…"
          className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm text-rose-700 transition-colors hover:bg-rose-50"
        >
          Eliminar idea
        </SubmitButton>
      </form>
    </AppShell>
  );
}
