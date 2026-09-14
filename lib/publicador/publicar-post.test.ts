import { describe, expect, it } from "vitest";
import { publicarPost } from "./publicar-post";
import type { DriveClient, MetaPublishClient, StorageClient } from "./types";

const CUENTA = { igUserId: "ig-1", accessToken: "token-meta" };
const INPUT = {
  driveFileId: "drive-1",
  driveAccessToken: "token-drive",
  caption: "Un caption",
  cuenta: CUENTA,
};

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
  opts: { fallaContenedor?: string; fallaPublicar?: string } = {}
): MetaPublishClient {
  return {
    async createImageContainer(igUserId, accessToken, params) {
      llamadas.push(`meta.createImageContainer(${igUserId}, ${params.imageUrl})`);
      if (opts.fallaContenedor) throw new Error(opts.fallaContenedor);
      return { containerId: "container-1" };
    },
    async publishContainer(igUserId, accessToken, containerId) {
      llamadas.push(`meta.publishContainer(${igUserId}, ${containerId})`);
      if (opts.fallaPublicar) throw new Error(opts.fallaPublicar);
      return { mediaId: "media-1" };
    },
  };
}

describe("publicarPost", () => {
  it("camino feliz: descarga, sube, crea contenedor, publica y borra el temporal, en orden", async () => {
    const llamadas: string[] = [];
    const resultado = await publicarPost(INPUT, {
      drive: fakeDrive(llamadas),
      storage: fakeStorage(llamadas),
      meta: fakeMeta(llamadas),
    });

    expect(resultado).toEqual({ estado: "publicada", metaMediaId: "media-1" });
    expect(llamadas).toEqual([
      "drive.descargarArchivo(drive-1, token-drive)",
      "storage.subir(drive-1, image/jpeg)",
      "meta.createImageContainer(ig-1, https://storage.example/drive-1)",
      "meta.publishContainer(ig-1, container-1)",
      "storage.borrar(drive-1)",
    ]);
  });

  it("formato no soportado: no sube a Storage ni llama a Meta", async () => {
    const llamadas: string[] = [];
    const resultado = await publicarPost(INPUT, {
      drive: fakeDrive(llamadas, { mimeType: "image/png" }),
      storage: fakeStorage(llamadas),
      meta: fakeMeta(llamadas),
    });

    expect(resultado.estado).toBe("fallida");
    expect(llamadas).toEqual(["drive.descargarArchivo(drive-1, token-drive)"]);
  });

  it("si Drive falla al descargar, no llama a Storage ni a Meta y devuelve fallida", async () => {
    const llamadas: string[] = [];
    const resultado = await publicarPost(INPUT, {
      drive: fakeDrive(llamadas, { falla: "Google Drive respondió 403" }),
      storage: fakeStorage(llamadas),
      meta: fakeMeta(llamadas),
    });

    expect(resultado).toEqual({ estado: "fallida", error: "Google Drive respondió 403" });
    expect(llamadas).toEqual(["drive.descargarArchivo(drive-1, token-drive)"]);
  });

  it("si Storage falla al subir, no llama a Meta, no intenta borrar, y devuelve fallida", async () => {
    const llamadas: string[] = [];
    const resultado = await publicarPost(INPUT, {
      drive: fakeDrive(llamadas),
      storage: fakeStorage(llamadas, { fallaSubir: "Supabase Storage: bucket lleno" }),
      meta: fakeMeta(llamadas),
    });

    expect(resultado).toEqual({ estado: "fallida", error: "Supabase Storage: bucket lleno" });
    expect(llamadas).toEqual([
      "drive.descargarArchivo(drive-1, token-drive)",
      "storage.subir(drive-1, image/jpeg)",
    ]);
  });

  it("si Meta rechaza el contenedor, igual borra el temporal de Storage", async () => {
    const llamadas: string[] = [];
    const resultado = await publicarPost(INPUT, {
      drive: fakeDrive(llamadas),
      storage: fakeStorage(llamadas),
      meta: fakeMeta(llamadas, { fallaContenedor: "la cuenta no tiene permiso" }),
    });

    expect(resultado).toEqual({ estado: "fallida", error: "la cuenta no tiene permiso" });
    expect(llamadas).toContain("storage.borrar(drive-1)");
  });

  it("si Meta rechaza el publish final, igual borra el temporal de Storage", async () => {
    const llamadas: string[] = [];
    const resultado = await publicarPost(INPUT, {
      drive: fakeDrive(llamadas),
      storage: fakeStorage(llamadas),
      meta: fakeMeta(llamadas, { fallaPublicar: "media aún procesando" }),
    });

    expect(resultado).toEqual({ estado: "fallida", error: "media aún procesando" });
    expect(llamadas).toContain("storage.borrar(drive-1)");
  });
});
