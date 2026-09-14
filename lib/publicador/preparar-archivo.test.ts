import { TipoPublicacion } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { prepararArchivo } from "./preparar-archivo";
import type { DriveClient, StorageClient } from "./types";

const INPUT = { driveFileId: "drive-1", driveAccessToken: "token-drive", tipoPublicacion: TipoPublicacion.post };

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

function fakeStorage(llamadas: string[] = [], opts: { falla?: string } = {}): StorageClient {
  return {
    async subir(nombre, _data, contentType) {
      llamadas.push(`storage.subir(${nombre}, ${contentType})`);
      if (opts.falla) throw new Error(opts.falla);
      return { url: `https://storage.example/${nombre}` };
    },
    async borrar(nombre) {
      llamadas.push(`storage.borrar(${nombre})`);
    },
  };
}

describe("prepararArchivo", () => {
  it("imagen soportada: descarga, sube y devuelve la URL con tipoMedia imagen", async () => {
    const llamadas: string[] = [];
    const resultado = await prepararArchivo(INPUT, {
      drive: fakeDrive(llamadas),
      storage: fakeStorage(llamadas),
    });

    expect(resultado).toEqual({
      ok: true,
      tipoMedia: "imagen",
      storageUrl: "https://storage.example/drive-1",
    });
    expect(llamadas).toEqual([
      "drive.descargarArchivo(drive-1, token-drive)",
      "storage.subir(drive-1, image/jpeg)",
    ]);
  });

  it("video soportado (Reel): descarga, sube y devuelve tipoMedia video", async () => {
    const llamadas: string[] = [];
    const resultado = await prepararArchivo(
      { ...INPUT, tipoPublicacion: TipoPublicacion.reel },
      { drive: fakeDrive(llamadas, { mimeType: "video/mp4" }), storage: fakeStorage(llamadas) }
    );

    expect(resultado).toEqual({
      ok: true,
      tipoMedia: "video",
      storageUrl: "https://storage.example/drive-1",
    });
  });

  it("formato de imagen no soportado: no sube a Storage", async () => {
    const llamadas: string[] = [];
    const resultado = await prepararArchivo(INPUT, {
      drive: fakeDrive(llamadas, { mimeType: "image/png" }),
      storage: fakeStorage(llamadas),
    });

    expect(resultado.ok).toBe(false);
    expect(llamadas).toEqual(["drive.descargarArchivo(drive-1, token-drive)"]);
  });

  it("Reel con imagen: rechazado (Reel siempre es video)", async () => {
    const llamadas: string[] = [];
    const resultado = await prepararArchivo(
      { ...INPUT, tipoPublicacion: TipoPublicacion.reel },
      { drive: fakeDrive(llamadas, { mimeType: "image/jpeg" }), storage: fakeStorage(llamadas) }
    );

    expect(resultado.ok).toBe(false);
    expect(llamadas).toEqual(["drive.descargarArchivo(drive-1, token-drive)"]);
  });

  it("formato de video no soportado: rechazado", async () => {
    const llamadas: string[] = [];
    const resultado = await prepararArchivo(INPUT, {
      drive: fakeDrive(llamadas, { mimeType: "video/x-msvideo" }),
      storage: fakeStorage(llamadas),
    });

    expect(resultado.ok).toBe(false);
    expect(llamadas).toEqual(["drive.descargarArchivo(drive-1, token-drive)"]);
  });

  it("si Drive falla, no llama a Storage", async () => {
    const llamadas: string[] = [];
    const resultado = await prepararArchivo(INPUT, {
      drive: fakeDrive(llamadas, { falla: "Google Drive respondió 403" }),
      storage: fakeStorage(llamadas),
    });

    expect(resultado).toEqual({ ok: false, error: "Google Drive respondió 403" });
    expect(llamadas).toEqual(["drive.descargarArchivo(drive-1, token-drive)"]);
  });

  it("si Storage falla al subir, devuelve el error", async () => {
    const llamadas: string[] = [];
    const resultado = await prepararArchivo(INPUT, {
      drive: fakeDrive(llamadas),
      storage: fakeStorage(llamadas, { falla: "Supabase Storage: bucket lleno" }),
    });

    expect(resultado).toEqual({ ok: false, error: "Supabase Storage: bucket lleno" });
  });
});
