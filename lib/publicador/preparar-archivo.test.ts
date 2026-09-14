import sharp from "sharp";
import { TipoPublicacion } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { prepararArchivo, prepararArchivos } from "./preparar-archivo";
import type { DriveClient, StorageClient } from "./types";

const INPUT = { driveFileId: "drive-1", driveAccessToken: "token-drive", tipoPublicacion: TipoPublicacion.post };

/** PNG real y mínimo — hace falta que sharp pueda parsearlo de verdad para probar la conversión. */
function pngDeUnPixel(): Promise<Buffer> {
  return sharp({ create: { width: 2, height: 2, channels: 3, background: { r: 255, g: 0, b: 0 } } })
    .png()
    .toBuffer();
}

function fakeDrive(
  llamadas: string[] = [],
  opts: { mimeType?: string; data?: Buffer; falla?: string; fallaEnId?: string } = {}
): DriveClient {
  return {
    async descargarArchivo(driveFileId, accessToken) {
      llamadas.push(`drive.descargarArchivo(${driveFileId}, ${accessToken})`);
      if (opts.falla || opts.fallaEnId === driveFileId) throw new Error(opts.falla ?? "formato rechazado");
      return { data: opts.data ?? Buffer.from("contenido"), mimeType: opts.mimeType ?? "image/jpeg" };
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

  it("PNG: se convierte a JPEG antes de subir (Instagram no acepta PNG)", async () => {
    const llamadas: string[] = [];
    const resultado = await prepararArchivo(INPUT, {
      drive: fakeDrive(llamadas, { mimeType: "image/png", data: await pngDeUnPixel() }),
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

  it("formato de imagen no convertible (ni JPEG ni PNG/WebP/GIF): no sube a Storage", async () => {
    const llamadas: string[] = [];
    const resultado = await prepararArchivo(INPUT, {
      drive: fakeDrive(llamadas, { mimeType: "image/bmp" }),
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

describe("prepararArchivos", () => {
  const INPUT_MULTI = {
    archivos: [{ driveFileId: "drive-1" }, { driveFileId: "drive-2" }],
    driveAccessToken: "token-drive",
    tipoPublicacion: TipoPublicacion.post,
  };

  it("camino feliz: prepara todos los archivos en orden", async () => {
    const llamadas: string[] = [];
    const resultado = await prepararArchivos(INPUT_MULTI, {
      drive: fakeDrive(llamadas),
      storage: fakeStorage(llamadas),
    });

    expect(resultado).toEqual({
      ok: true,
      archivos: [
        { driveFileId: "drive-1", tipoMedia: "imagen", storageUrl: "https://storage.example/drive-1" },
        { driveFileId: "drive-2", tipoMedia: "imagen", storageUrl: "https://storage.example/drive-2" },
      ],
    });
  });

  it("si uno falla a mitad de la lista, borra los que ya se subieron y devuelve el error", async () => {
    const llamadas: string[] = [];
    const resultado = await prepararArchivos(
      { ...INPUT_MULTI, archivos: [{ driveFileId: "drive-1" }, { driveFileId: "drive-2" }, { driveFileId: "drive-3" }] },
      { drive: fakeDrive(llamadas, { fallaEnId: "drive-2" }), storage: fakeStorage(llamadas) }
    );

    expect(resultado).toEqual({ ok: false, error: "formato rechazado" });
    expect(llamadas).toContain("storage.borrar(drive-1)");
    expect(llamadas).not.toContain("storage.subir(drive-3, image/jpeg)");
  });
});
