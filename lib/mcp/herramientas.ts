import { z } from "zod";
import { EstadoIdea, Prisma, TipoPublicacion } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { whereCuentasIdea, wherePublicadaIdea } from "@/lib/ideas/cuentas-de-idea";
import {
  actualizarIdea,
  calendarizarIdea,
  cambiarEstadoIdea,
  crearIdea,
  descalendarizarIdea,
  eliminarIdea,
  marcarEnDrive,
  marcarProgramadaEnIg,
  marcarPublicada,
  reordenarArchivosIdea,
} from "@/app/ideas/actions";
import { resolverLinkDrive } from "@/app/publicar/actions";
import { faltaProgramarEnIg } from "@/components/etiqueta-estado-idea";
import { mensajeDeError } from "@/lib/mensaje-de-error";
import type { Herramienta } from "./protocolo";

const ZONA = "America/Argentina/Buenos_Aires";
const formatoLocal = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, dateStyle: "full", timeStyle: "short" });

function conFecha(fecha: Date | null) {
  return {
    programadaPara: fecha?.toISOString() ?? null,
    programadaParaLocal: fecha ? formatoLocal.format(fecha) : null,
  };
}

// ─── Esquemas de entrada ────────────────────────────────────────────────────

const fecha = z.iso
  .datetime({ offset: true })
  .describe(`Fecha y hora ISO 8601 con offset, ej. 2026-10-20T18:30:00-03:00. Sin otra indicación del usuario, asumí ${ZONA} (-03:00).`);
const tipo = z.enum(["post", "historia", "reel"]);
const cuentaId = z.string().min(1).describe("Id de la Cuenta (ver listar_cuentas).");
const productoId = z
  .string()
  .min(1)
  .describe("Id del Producto (ver listar_cuentas). Sin producto = idea general, de marca.");
const limite = (def: number) => z.number().int().min(1).max(100).default(def);

const textoLibre = {
  titulo: z.string().trim().min(1).max(200).describe("Título interno de la idea (no sale en Instagram)."),
  descripcion: z.string().max(2000).describe("Resumen interno de la idea."),
  guion: z.string().max(10000).describe("Notas de producción / guión."),
  caption: z.string().max(2200).describe("Texto real que sale en Instagram (límite de IG: 2200 caracteres). Si falta, se usa el título."),
  audio: z.string().trim().max(200).describe("Audio de la biblioteca de Instagram a usar al programarla en la app (canción – artista)."),
  linkReferencia: z.string().url().max(500).describe("Link de referencia."),
};

// ─── Serialización ──────────────────────────────────────────────────────────

const incluirResumen = {
  cuenta: { select: { id: true, nombre: true, igUsername: true } },
  colaboradoras: { select: { id: true, nombre: true, igUsername: true } },
  producto: { select: { id: true, nombre: true } },
  publicaciones: { select: { id: true, estado: true, error: true, publicadaEn: true } },
  _count: { select: { archivos: true } },
} satisfies Prisma.IdeaInclude;

type IdeaResumen = Prisma.IdeaGetPayload<{ include: typeof incluirResumen }>;

function resumenIdea(idea: IdeaResumen) {
  return {
    id: idea.id,
    cuenta: idea.cuenta,
    colaboradoras: idea.colaboradoras,
    producto: idea.producto,
    titulo: idea.titulo,
    tipo: idea.tipo,
    estado: idea.estado,
    ...conFecha(idea.programadaPara),
    caption: idea.caption,
    audio: idea.audio,
    driveLink: idea.driveLink,
    archivosEnCarpeta: idea._count.archivos,
    faltaProgramarEnIg: faltaProgramarEnIg(idea),
    programadaEnIgEl: idea.programadaEnIgEl?.toISOString() ?? null,
    publicadaEl: idea.publicadaEl?.toISOString() ?? null,
    // Historial de lo que el panel publicó antes de ADR-0020; hoy el panel no publica.
    publicaciones: idea.publicaciones,
  };
}

async function cargarIdea(id: string) {
  const idea = await prisma.idea.findUnique({
    where: { id },
    include: { ...incluirResumen, archivos: { orderBy: { orden: "asc" } } },
  });
  if (!idea) throw new Error("Idea no encontrada.");
  return idea;
}

async function detalleIdea(id: string) {
  const idea = await cargarIdea(id);
  return {
    ...resumenIdea(idea),
    descripcion: idea.descripcion,
    guion: idea.guion,
    linkReferencia1: idea.linkReferencia1,
    linkReferencia2: idea.linkReferencia2,
    archivos: idea.archivos.map((a) => ({ id: a.id, orden: a.orden, nombre: a.nombre })),
  };
}

// ─── Definición de herramientas ─────────────────────────────────────────────

function definir<S extends z.ZodType>(def: {
  name: string;
  title: string;
  description: string;
  schema: S;
  annotations?: Herramienta["annotations"];
  run: (entrada: z.output<S>) => Promise<unknown>;
}): Herramienta {
  const inputSchema = z.toJSONSchema(def.schema, { io: "input" }) as Record<string, unknown>;
  delete inputSchema.$schema;
  return {
    name: def.name,
    title: def.title,
    description: def.description,
    inputSchema,
    annotations: def.annotations,
    ejecutar: async (argumentos) => {
      const parseado = def.schema.safeParse(argumentos);
      if (!parseado.success) {
        const detalle = parseado.error.issues.map((i) => `${i.path.join(".") || "(raíz)"}: ${i.message}`).join("; ");
        throw new Error(`Argumentos inválidos — ${detalle}`);
      }
      return def.run(parseado.data);
    },
  };
}

const SOLO_LECTURA = { readOnlyHint: true, openWorldHint: false } as const;

export const herramientas: Herramienta[] = [
  definir({
    name: "listar_cuentas",
    title: "Listar cuentas de Instagram",
    description:
      "Lista las Cuentas de Instagram del panel con su id, @usuario, estado y productos (cada idea puede asociarse a un producto de su Cuenta, o ser general/de marca). Es el primer paso: casi todo lo demás pide el id de la Cuenta.",
    schema: z.object({}),
    annotations: SOLO_LECTURA,
    run: async () => {
      const cuentas = await prisma.cuenta.findMany({
        orderBy: { nombre: "asc" },
        select: {
          id: true,
          nombre: true,
          igUsername: true,
          estado: true,
          productos: { select: { id: true, nombre: true }, orderBy: { nombre: "asc" } },
        },
      });
      return cuentas;
    },
  }),

  definir({
    name: "ver_agenda",
    title: "Ver agenda / calendario",
    description:
      "Lo que está calendarizado en un rango de fechas, ordenado por fecha: Ideas con fecha (cada una indica si falta programarla en Instagram) y Publicaciones sueltas históricas. Usalo para ver huecos antes de proponer horarios.",
    schema: z.object({
      desde: fecha,
      hasta: fecha,
      cuentaId: cuentaId.optional().describe("Filtrar por una Cuenta; si falta, todas."),
    }),
    annotations: SOLO_LECTURA,
    run: async ({ desde, hasta, cuentaId }) => {
      const rango = { gte: new Date(desde), lte: new Date(hasta) };
      const [ideas, sueltas] = await Promise.all([
        prisma.idea.findMany({
          where: { programadaPara: rango, ...whereCuentasIdea(cuentaId ? [cuentaId] : null) },
          include: incluirResumen,
          orderBy: { programadaPara: "asc" },
          take: 100,
        }),
        prisma.publicacion.findMany({
          where: { programadaPara: rango, ideaId: null, ...(cuentaId && { cuentaId }) },
          include: { cuenta: { select: { id: true, nombre: true, igUsername: true } } },
          orderBy: { programadaPara: "asc" },
          take: 100,
        }),
      ]);
      return {
        ideas: ideas.map(resumenIdea),
        publicacionesSueltas: sueltas.map((p) => ({
          id: p.id,
          cuenta: p.cuenta,
          tipo: p.tipo,
          estado: p.estado,
          caption: p.caption,
          error: p.error,
          ...conFecha(p.programadaPara),
        })),
      };
    },
  }),

  definir({
    name: "listar_ideas",
    title: "Listar ideas",
    description: "Lista Ideas (el notebook de contenido) con filtros opcionales. Devuelve un resumen; para el detalle completo usá ver_idea.",
    schema: z.object({
      cuentaId: cuentaId.optional(),
      estado: z.enum(["idea", "guionada", "grabada", "enDrive"]).optional(),
      productoId: productoId.optional().describe("Sólo las ideas de este Producto."),
      soloGenerales: z.boolean().optional().describe("true = sólo las ideas generales (sin producto)."),
      tipo: tipo.optional(),
      sinFecha: z.boolean().optional().describe("true = sólo las que todavía no están calendarizadas."),
      faltaProgramarEnIg: z.boolean().optional().describe("true = sólo las enDrive con fecha que todavía no se marcaron como programadas en la app de Instagram."),
      publicadas: z.boolean().optional().describe("true = sólo las ya publicadas; por defecto las publicadas NO se listan (como en el panel)."),
      limite: limite(30),
    }),
    annotations: SOLO_LECTURA,
    run: async ({ cuentaId, estado, productoId, soloGenerales, tipo, sinFecha, faltaProgramarEnIg, publicadas, limite }) => {
      const ideas = await prisma.idea.findMany({
        where: {
          AND: [whereCuentasIdea(cuentaId ? [cuentaId] : null), wherePublicadaIdea(publicadas === true)],
          ...(estado && { estado }),
          ...(productoId && { productoId }),
          ...(soloGenerales && !productoId && { productoId: null }),
          ...(tipo && { tipo }),
          ...(sinFecha && { programadaPara: null }),
          ...(faltaProgramarEnIg && { estado: EstadoIdea.enDrive, programadaPara: { not: null }, programadaEnIgEl: null }),
        },
        include: incluirResumen,
        orderBy: { actualizadaEn: "desc" },
        take: limite,
      });
      return ideas.map(resumenIdea);
    },
  }),

  definir({
    name: "ver_idea",
    title: "Ver una idea",
    description: "Detalle completo de una Idea: guión, caption, audio, links, archivos de su carpeta (con ids para reordenar) y si ya está programada en Instagram.",
    schema: z.object({ id: z.string().min(1) }),
    annotations: SOLO_LECTURA,
    run: ({ id }) => detalleIdea(id),
  }),

  definir({
    name: "listar_publicaciones",
    title: "Listar publicaciones",
    description: "Historial de Publicaciones que el panel subió a Instagram antes de dejar de publicar (ver INSTRUCCIONES). El panel ya no crea nuevas.",
    schema: z.object({
      cuentaId: cuentaId.optional(),
      estado: z.enum(["pendiente", "publicando", "publicada", "fallida", "cancelada", "bloqueadaPorLimite"]).optional(),
      limite: limite(20),
    }),
    annotations: SOLO_LECTURA,
    run: async ({ cuentaId, estado, limite }) => {
      const publicaciones = await prisma.publicacion.findMany({
        where: { ...(cuentaId && { cuentaId }), ...(estado && { estado }) },
        include: {
          cuenta: { select: { id: true, nombre: true, igUsername: true } },
          _count: { select: { archivos: true } },
        },
        orderBy: { creadaEn: "desc" },
        take: limite,
      });
      return publicaciones.map((p) => ({
        id: p.id,
        cuenta: p.cuenta,
        tipo: p.tipo,
        estado: p.estado,
        ideaId: p.ideaId,
        caption: p.caption,
        elementosCarousel: p._count.archivos || undefined,
        error: p.error,
        publicadaEn: p.publicadaEn?.toISOString() ?? null,
        ...conFecha(p.programadaPara),
      }));
    },
  }),

  definir({
    name: "listar_archivos_drive",
    title: "Ver archivos de un link de Drive",
    description:
      "Resuelve un link de Google Drive (archivo o carpeta) y lista los fotos/videos que Instagram acepta, en el orden en que Drive los devuelve. Sirve para verificar un link antes de usarlo en crear_idea.",
    schema: z.object({
      link: z.string().url(),
      tipo: tipo.describe("Tipo de Publicación para el que se usaría (un Reel no admite carpeta)."),
    }),
    annotations: { ...SOLO_LECTURA, openWorldHint: true },
    run: async ({ link, tipo }) => {
      const archivos = await resolverLinkDrive(link, tipo as TipoPublicacion);
      return archivos.map((a) => ({ nombre: a.nombre, mimeType: a.mimeType }));
    },
  }),

  definir({
    name: "crear_idea",
    title: "Crear idea (y opcionalmente dejarla lista para programar)",
    description: [
      "Crea una Idea en una Cuenta. Es la vía para TODO el contenido: post, carousel, historia o reel.",
      "El panel NO publica en Instagram. Con `driveLink` + `programadaPara` la Idea queda lista y aparece como \"falta programar en IG\": el dueño la programa a mano en la app de Instagram (así puede elegir el audio de la biblioteca) y después se marca con marcar_programada_en_ig.",
      "- Post con link de ARCHIVO = una sola foto o video. Post con carpeta de Drive = carousel (2-10 archivos). Historia con archivo = una historia; con carpeta = una por archivo, en orden. Reel = un solo video (link de archivo, no de carpeta).",
      "- `audio`: nombre del audio de la biblioteca de IG a usar (canción – artista); es una nota para quien la programa en la app.",
      "- Sin `driveLink` la idea es sólo una nota; `programadaPara` sin `driveLink` es un recordatorio.",
    ].join("\n"),
    schema: z.object({
      cuentaId,
      colaboradoraIds: z.array(cuentaId).optional().describe("Otras Cuentas que participan en colab en esta idea (además de cuentaId, la principal). Omitilo para una idea de una sola Cuenta."),
      productoId: productoId.optional().describe("Producto de la Cuenta al que pertenece la idea; omitilo para una idea general (de marca)."),
      tipo,
      titulo: textoLibre.titulo,
      descripcion: textoLibre.descripcion.optional(),
      guion: textoLibre.guion.optional(),
      caption: textoLibre.caption.optional(),
      audio: textoLibre.audio.optional(),
      linkReferencia1: textoLibre.linkReferencia.optional(),
      linkReferencia2: textoLibre.linkReferencia.optional(),
      driveLink: z.string().url().optional().describe("Link de Drive al archivo o a la carpeta ya subida. Con esto la idea pasa a estado enDrive."),
      programadaPara: fecha.optional(),
    }),
    run: async (entrada) => {
      const id = await crearIdea({
        cuentaId: entrada.cuentaId,
        colaboradoraIds: entrada.colaboradoraIds,
        productoId: entrada.productoId,
        titulo: entrada.titulo,
        tipo: entrada.tipo as TipoPublicacion,
        descripcion: entrada.descripcion,
        guion: entrada.guion,
        caption: entrada.caption,
        audio: entrada.audio,
        linkReferencia1: entrada.linkReferencia1,
        linkReferencia2: entrada.linkReferencia2,
      });

      try {
        if (entrada.driveLink) await marcarEnDrive(id, entrada.driveLink);
        if (entrada.programadaPara) {
          await calendarizarIdea(id, new Date(entrada.programadaPara));
        }
      } catch (error) {
        throw new Error(`La idea se creó (id ${id}) pero no se pudo completar: ${mensajeDeError(error)} Corregilo con actualizar_idea.`);
      }

      return { idea: await detalleIdea(id) };
    },
  }),

  definir({
    name: "actualizar_idea",
    title: "Actualizar / reprogramar idea",
    description: [
      "Modifica una Idea. Sólo se cambia lo que pasás; `null` borra el campo.",
      "- `programadaPara`: fecha = (re)programar (si cambia, se desmarca como programada en IG); null = sacarla del calendario.",
      "- `driveLink`: pasa la idea a enDrive.",
      "- `estado`: idea | guionada | grabada (enDrive se logra con driveLink).",
      "- Colab: agregarColaboradoraIds / quitarColaboradoraIds suman o sacan Cuentas sin tocar las demás; colaboradoraIds reemplaza la lista completa.",
      "- Para marcar que ya la programaron en la app de Instagram usá marcar_programada_en_ig.",
    ].join("\n"),
    schema: z.object({
      id: z.string().min(1),
      colaboradoraIds: z.array(cuentaId).optional().describe("Reemplaza las Cuentas en colab de la idea (lista vacía = sin colab). Omitilo para no tocarlas."),
      agregarColaboradoraIds: z.array(cuentaId).optional().describe("Suma estas Cuentas al colab de la idea sin tocar las que ya tiene."),
      quitarColaboradoraIds: z.array(cuentaId).optional().describe("Saca estas Cuentas del colab de la idea."),
      productoId: productoId.nullable().optional().describe("Producto de la idea; null = pasarla a general (de marca)."),
      titulo: textoLibre.titulo.optional(),
      descripcion: textoLibre.descripcion.nullable().optional(),
      guion: textoLibre.guion.nullable().optional(),
      caption: textoLibre.caption.nullable().optional(),
      audio: textoLibre.audio.nullable().optional(),
      linkReferencia1: textoLibre.linkReferencia.nullable().optional(),
      linkReferencia2: textoLibre.linkReferencia.nullable().optional(),
      estado: z.enum(["idea", "guionada", "grabada"]).optional(),
      driveLink: z.string().url().optional(),
      programadaPara: fecha.nullable().optional(),
    }),
    run: async (entrada) => {
      const actual = await prisma.idea.findUnique({
        where: { id: entrada.id },
        include: { colaboradoras: { select: { id: true } } },
      });
      if (!actual) throw new Error("Idea no encontrada.");
      if (entrada.colaboradoraIds && (entrada.agregarColaboradoraIds || entrada.quitarColaboradoraIds)) {
        throw new Error("Pasá colaboradoraIds (reemplaza todo) o agregarColaboradoraIds/quitarColaboradoraIds, no los dos.");
      }
      let colaboradoraIds = entrada.colaboradoraIds;
      if (entrada.agregarColaboradoraIds || entrada.quitarColaboradoraIds) {
        const quitar = new Set(entrada.quitarColaboradoraIds ?? []);
        colaboradoraIds = [
          ...new Set([...actual.colaboradoras.map((c) => c.id), ...(entrada.agregarColaboradoraIds ?? [])]),
        ].filter((id) => !quitar.has(id));
      }
      if (entrada.driveLink && entrada.estado) {
        throw new Error("Pasá driveLink o estado, no los dos: driveLink ya deja la idea en enDrive.");
      }

      const cambiaTexto = ["colaboradoraIds", "agregarColaboradoraIds", "quitarColaboradoraIds", "productoId", "titulo", "descripcion", "guion", "caption", "audio", "linkReferencia1", "linkReferencia2"].some(
        (campo) => campo in entrada && entrada[campo as keyof typeof entrada] !== undefined
      );
      if (cambiaTexto) {
        // actualizarIdea pisa todos los campos de texto: se le pasa el valor actual de los que no cambian.
        const elegir = <T extends string | null | undefined>(nuevo: T | undefined, viejo: string | null) =>
          (nuevo === undefined ? viejo : nuevo) ?? undefined;
        await actualizarIdea(entrada.id, {
          colaboradoraIds,
          productoId: entrada.productoId,
          titulo: entrada.titulo ?? actual.titulo,
          descripcion: elegir(entrada.descripcion, actual.descripcion),
          guion: elegir(entrada.guion, actual.guion),
          caption: elegir(entrada.caption, actual.caption),
          audio: elegir(entrada.audio, actual.audio),
          linkReferencia1: elegir(entrada.linkReferencia1, actual.linkReferencia1),
          linkReferencia2: elegir(entrada.linkReferencia2, actual.linkReferencia2),
        });
      }

      if (entrada.driveLink) await marcarEnDrive(entrada.id, entrada.driveLink);
      if (entrada.estado) await cambiarEstadoIdea(entrada.id, entrada.estado as (typeof EstadoIdea)["idea"]);

      if (entrada.programadaPara === null) {
        await descalendarizarIdea(entrada.id);
      } else if (entrada.programadaPara) {
        await calendarizarIdea(entrada.id, new Date(entrada.programadaPara));
      }

      return detalleIdea(entrada.id);
    },
  }),

  definir({
    name: "marcar_publicada",
    title: "Marcar idea como publicada",
    description:
      "Registra que la Idea ya salió en Instagram: deja de aparecer en el listado de ideas (listar_ideas con publicadas=true la muestra). No publica nada. Usalo sólo cuando el usuario confirme que ya se publicó. `publicada: false` la vuelve al listado.",
    schema: z.object({ id: z.string().min(1), publicada: z.boolean().default(true) }),
    annotations: { idempotentHint: true, openWorldHint: false },
    run: async ({ id, publicada }) => {
      await marcarPublicada(id, publicada);
      return detalleIdea(id);
    },
  }),

  definir({
    name: "marcar_programada_en_ig",
    title: "Marcar idea como programada en Instagram",
    description:
      "Registra que el dueño ya programó esta Idea en la app de Instagram (sale de la lista \"falta programar en IG\"). No publica nada. Usalo sólo cuando el usuario confirme que ya la programó. `programada: false` la vuelve a marcar como pendiente. La Idea tiene que tener fecha.",
    schema: z.object({ id: z.string().min(1), programada: z.boolean().default(true) }),
    annotations: { idempotentHint: true, openWorldHint: false },
    run: async ({ id, programada }) => {
      await marcarProgramadaEnIg(id, programada);
      return detalleIdea(id);
    },
  }),

  definir({
    name: "ordenar_archivos_idea",
    title: "Reordenar archivos de una carpeta",
    description:
      "Define el orden final de los archivos de una Idea con carpeta de Drive (orden de las láminas de un carousel o de las historias). Pasá TODOS los ids de `archivos` (de ver_idea) en el orden deseado.",
    schema: z.object({ id: z.string().min(1), idsEnOrden: z.array(z.string().min(1)).min(2) }),
    annotations: { idempotentHint: true, openWorldHint: false },
    run: async ({ id, idsEnOrden }) => {
      await reordenarArchivosIdea(id, idsEnOrden);
      return detalleIdea(id);
    },
  }),

  definir({
    name: "eliminar_idea",
    title: "Eliminar idea",
    description: "Borra la Idea del panel. No toca nada en Instagram (si ya estaba programada en la app, hay que borrarla ahí a mano). Irreversible.",
    schema: z.object({ id: z.string().min(1) }),
    annotations: { destructiveHint: true, openWorldHint: false },
    run: async ({ id }) => {
      await eliminarIdea(id);
      return { eliminada: id };
    },
  }),
];

export const INSTRUCCIONES = [
  "Panel para organizar contenido (posts, carousels, historias y reels) de varias Cuentas de Instagram. NO publica ni programa en Instagram: la programación se hace a mano en la app de IG (para poder elegir audios de su biblioteca).",
  "",
  "Flujo: listar_cuentas → crear_idea → (el dueño la programa en la app de IG) → marcar_programada_en_ig.",
  "",
  "- Una Idea con `driveLink` + `programadaPara` queda lista y figura como \"falta programar en IG\" (listar_ideas con faltaProgramarEnIg=true). Cuando el usuario confirme que ya la programó en la app, llamá marcar_programada_en_ig.",
  "- Cuando la idea ya salió en Instagram, marcar_publicada la saca del listado (las publicadas no aparecen en listar_ideas salvo publicadas=true).",
  "- Una idea puede ser un colab entre varias Cuentas: `cuentaId` es la principal y `colaboradoraIds` las demás; aparece en la agenda y los filtros de todas. El producto, si hay, es de la Cuenta principal.",
  "- Cada Cuenta puede tener productos (ver listar_cuentas). Una idea se asocia a uno con `productoId`; sin producto es una idea general, de marca. Cuentas sin productos (ej.: software o servicios) sólo tienen ideas de marca.",
  "- `audio` es el nombre del audio de IG a usar; sirve de recordatorio para quien programa en la app.",
  "- El archivo tiene que estar en Google Drive; el panel no recibe archivos. Pasá el link de compartir del archivo o de la carpeta.",
  "- Post de una sola foto/video = link del archivo. Carousel = Post con carpeta (2-10 archivos). Historias = archivo suelto, o carpeta con un archivo por historia. Reel = un solo video.",
  `- Fechas en ISO 8601 con offset. Si el usuario no aclara zona, asumí ${ZONA} (-03:00). Cambiar la fecha de una Idea la desmarca como programada en IG.`,
  "- Mirá ver_agenda antes de proponer horarios.",
].join("\n");
