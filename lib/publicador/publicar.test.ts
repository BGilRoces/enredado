import { TipoPublicacion } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { publicar } from "./publicar";
import type { DriveClient, EstadoContenedor, MetaPublishClient, StorageClient } from "./types";

const CUENTA = { igUserId: "ig-1", accessToken: "token-meta" };

function input(overrides: Partial<Parameters<typeof publicar>[0]> = {}) {
  return {
    driveFileId: "drive-1",
    driveAccessToken: "token-drive",
    tipoPublicacion: TipoPublicacion.post,
    caption: "Un caption",
    cuenta: CUENTA,
    ...overrides,
  };
}

function fakeDrive(
  llamadas: string[] = [],
  opts: { mimeType?: string; falla?: string } = {}
): DriveClient {
  return {
    async descargarArchivo(driveFileId, accessToken) {
      llamadas.push(`drive.descargarArchivo(${driveFileId}, ${accessToken})`);
      if (opts.falla) throw new Error(opts.falla);
      return { data: Buffer.from("contenido"), mimeType: opts.mimeType ?? "image/jpeg" };
    },
  };
}

function fakeStorage(llamadas: string[] = [], opts: { fallaSubir?: string } = {}): StorageClient {
  return {
    async subir(nombre, _data, contentType) {
      llamadas.push(`storage.subir(${nombre}, ${contentType})`);
      if (opts.fallaSubir) throw new Error(opts.fallaSubir);
      return { url: `https://storage.example/${nombre}` };
    },
    async borrar(nombre) {
      llamadas.push(`storage.borrar(${nombre})`);
    },
  };
}

function fakeMeta(
  llamadas: string[] = [],
  opts: {
    fallaContenedor?: string;
    fallaPublicar?: string;
    /** secuencia de estados que devuelve getContainerStatus, uno por llamada */
    estados?: EstadoContenedor[];
  } = {}
): MetaPublishClient {
  const estados = opts.estados ?? ["listo"];
  let consulta = 0;
  return {
    async createContainer(igUserId, accessToken, params) {
      llamadas.push(`meta.createContainer(${igUserId}, ${params.tipoPublicacion}, ${params.media.tipo})`);
      if (opts.fallaContenedor) throw new Error(opts.fallaContenedor);
      return { containerId: "container-1" };
    },
    async getContainerStatus(igUserId, accessToken, containerId) {
      const estado = estados[Math.min(consulta, estados.length - 1)];
      consulta++;
      llamadas.push(`meta.getContainerStatus(${containerId}) -> ${estado}`);
      return estado;
    },
    async publishContainer(igUserId, accessToken, containerId) {
      llamadas.push(`meta.publishContainer(${igUserId}, ${containerId})`);
      if (opts.fallaPublicar) throw new Error(opts.fallaPublicar);
      return { mediaId: "media-1" };
    },
  };
}

function noEsperar() {
  return async () => {};
}

describe("publicar — Post con imagen (camino ya cubierto, no debe romperse)", () => {
  it("camino feliz: descarga, sube, crea contenedor, publica sin esperar (imagen no se transcodifica) y borra el temporal", async () => {
    const llamadas: string[] = [];
    const resultado = await publicar(input(), {
      drive: fakeDrive(llamadas),
      storage: fakeStorage(llamadas),
      meta: fakeMeta(llamadas),
      esperar: noEsperar(),
    });

    expect(resultado).toEqual({ estado: "publicada", metaMediaId: "media-1" });
    expect(llamadas).toEqual([
      "drive.descargarArchivo(drive-1, token-drive)",
      "storage.subir(drive-1, image/jpeg)",
      "meta.createContainer(ig-1, post, imagen)",
      "meta.publishContainer(ig-1, container-1)",
      "storage.borrar(drive-1)",
    ]);
  });

  it("formato de imagen no soportado: no sube a Storage ni llama a Meta", async () => {
    const llamadas: string[] = [];
    const resultado = await publicar(input(), {
      drive: fakeDrive(llamadas, { mimeType: "image/png" }),
      storage: fakeStorage(llamadas),
      meta: fakeMeta(llamadas),
      esperar: noEsperar(),
    });

    expect(resultado.estado).toBe("fallida");
    expect(llamadas).toEqual(["drive.descargarArchivo(drive-1, token-drive)"]);
  });

  it("si Drive falla al descargar, devuelve fallida sin tocar Storage ni Meta", async () => {
    const llamadas: string[] = [];
    const resultado = await publicar(input(), {
      drive: fakeDrive(llamadas, { falla: "Google Drive respondió 403" }),
      storage: fakeStorage(llamadas),
      meta: fakeMeta(llamadas),
      esperar: noEsperar(),
    });

    expect(resultado).toEqual({ estado: "fallida", error: "Google Drive respondió 403" });
    expect(llamadas).toEqual(["drive.descargarArchivo(drive-1, token-drive)"]);
  });

  it("si Storage falla al subir, no llama a Meta, no intenta borrar, y devuelve fallida", async () => {
    const llamadas: string[] = [];
    const resultado = await publicar(input(), {
      drive: fakeDrive(llamadas),
      storage: fakeStorage(llamadas, { fallaSubir: "Supabase Storage: bucket lleno" }),
      meta: fakeMeta(llamadas),
      esperar: noEsperar(),
    });

    expect(resultado).toEqual({ estado: "fallida", error: "Supabase Storage: bucket lleno" });
    expect(llamadas).toEqual([
      "drive.descargarArchivo(drive-1, token-drive)",
      "storage.subir(drive-1, image/jpeg)",
    ]);
  });

  it("si Meta rechaza el contenedor, igual borra el temporal de Storage", async () => {
    const llamadas: string[] = [];
    const resultado = await publicar(input(), {
      drive: fakeDrive(llamadas),
      storage: fakeStorage(llamadas),
      meta: fakeMeta(llamadas, { fallaContenedor: "la cuenta no tiene permiso" }),
      esperar: noEsperar(),
    });

    expect(resultado).toEqual({ estado: "fallida", error: "la cuenta no tiene permiso" });
    expect(llamadas).toContain("storage.borrar(drive-1)");
  });

  it("si Meta rechaza el publish final, igual borra el temporal de Storage", async () => {
    const llamadas: string[] = [];
    const resultado = await publicar(input(), {
      drive: fakeDrive(llamadas),
      storage: fakeStorage(llamadas),
      meta: fakeMeta(llamadas, { fallaPublicar: "media aún procesando" }),
      esperar: noEsperar(),
    });

    expect(resultado).toEqual({ estado: "fallida", error: "media aún procesando" });
    expect(llamadas).toContain("storage.borrar(drive-1)");
  });
});

describe("publicar — Historia y Reel, imagen y video (ticket 04)", () => {
  it("Historia con imagen: camino feliz", async () => {
    const llamadas: string[] = [];
    const resultado = await publicar(input({ tipoPublicacion: TipoPublicacion.historia }), {
      drive: fakeDrive(llamadas, { mimeType: "image/jpeg" }),
      storage: fakeStorage(llamadas),
      meta: fakeMeta(llamadas),
      esperar: noEsperar(),
    });

    expect(resultado.estado).toBe("publicada");
    expect(llamadas).toContain("meta.createContainer(ig-1, historia, imagen)");
    expect(llamadas.some((l) => l.startsWith("meta.getContainerStatus"))).toBe(false);
  });

  it("Reel con video: espera el procesamiento (varios 'en_progreso' antes de 'listo') y publica", async () => {
    const llamadas: string[] = [];
    let esperas = 0;
    const resultado = await publicar(
      input({ tipoPublicacion: TipoPublicacion.reel, caption: "Reel nuevo" }),
      {
        drive: fakeDrive(llamadas, { mimeType: "video/mp4" }),
        storage: fakeStorage(llamadas),
        meta: fakeMeta(llamadas, { estados: ["en_progreso", "en_progreso", "listo"] }),
        esperar: async () => {
          esperas++;
        },
      }
    );

    expect(resultado).toEqual({ estado: "publicada", metaMediaId: "media-1" });
    expect(llamadas).toContain("meta.createContainer(ig-1, reel, video)");
    expect(
      llamadas.filter((l) => l.startsWith("meta.getContainerStatus")).length
    ).toBe(3);
    expect(esperas).toBe(2);
  });

  it("Reel con formato de imagen: rechazado antes de subir a Storage (Reels solo aceptan video)", async () => {
    const llamadas: string[] = [];
    const resultado = await publicar(input({ tipoPublicacion: TipoPublicacion.reel }), {
      drive: fakeDrive(llamadas, { mimeType: "image/jpeg" }),
      storage: fakeStorage(llamadas),
      meta: fakeMeta(llamadas),
      esperar: noEsperar(),
    });

    expect(resultado.estado).toBe("fallida");
    expect(llamadas).toEqual(["drive.descargarArchivo(drive-1, token-drive)"]);
  });

  it("formato de video no soportado: rechazado antes de subir a Storage", async () => {
    const llamadas: string[] = [];
    const resultado = await publicar(input({ tipoPublicacion: TipoPublicacion.post }), {
      drive: fakeDrive(llamadas, { mimeType: "video/x-msvideo" }),
      storage: fakeStorage(llamadas),
      meta: fakeMeta(llamadas),
      esperar: noEsperar(),
    });

    expect(resultado.estado).toBe("fallida");
    expect(llamadas).toEqual(["drive.descargarArchivo(drive-1, token-drive)"]);
  });

  it("si Meta devuelve 'error' mientras procesa el video, nunca publica y borra el temporal", async () => {
    const llamadas: string[] = [];
    const resultado = await publicar(input({ tipoPublicacion: TipoPublicacion.reel }), {
      drive: fakeDrive(llamadas, { mimeType: "video/mp4" }),
      storage: fakeStorage(llamadas),
      meta: fakeMeta(llamadas, { estados: ["en_progreso", "error"] }),
      esperar: noEsperar(),
    });

    expect(resultado.estado).toBe("fallida");
    expect(llamadas).not.toContain("meta.publishContainer(ig-1, container-1)");
    expect(llamadas).toContain("storage.borrar(drive-1)");
  });

  it("si Meta nunca termina de procesar, vence por timeout, nunca publica y borra el temporal", async () => {
    const llamadas: string[] = [];
    const siempreEnProgreso = Array(50).fill("en_progreso") as EstadoContenedor[];
    const resultado = await publicar(input({ tipoPublicacion: TipoPublicacion.reel }), {
      drive: fakeDrive(llamadas, { mimeType: "video/mp4" }),
      storage: fakeStorage(llamadas),
      meta: fakeMeta(llamadas, { estados: siempreEnProgreso }),
      esperar: noEsperar(),
    });

    expect(resultado.estado).toBe("fallida");
    expect(llamadas).not.toContain("meta.publishContainer(ig-1, container-1)");
    expect(llamadas).toContain("storage.borrar(drive-1)");
  });
});
