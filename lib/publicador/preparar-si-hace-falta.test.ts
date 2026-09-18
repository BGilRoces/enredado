import { TipoPublicacion } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { prepararSiHaceFalta } from "./preparar-si-hace-falta";
import type { DriveClient, StorageClient } from "./types";

const PUBLICACION_SIMPLE = {
  tipo: TipoPublicacion.post,
  driveFileId: "drive-1",
  driveResourceKey: null,
  archivos: [],
};

function fakeDrive(llamadas: string[] = []): DriveClient {
  return {
    async descargarArchivo(driveFileId, accessToken) {
      llamadas.push(`drive.descargarArchivo(${driveFileId}, ${accessToken})`);
      return { data: Buffer.from("contenido"), mimeType: "image/jpeg" };
    },
  };
}

function fakeStorage(llamadas: string[] = []): StorageClient {
  return {
    async subir(nombre, _data, contentType) {
      llamadas.push(`storage.subir(${nombre}, ${contentType})`);
      return { url: `https://storage.example/${nombre}` };
    },
    async borrar(nombre) {
      llamadas.push(`storage.borrar(${nombre})`);
    },
  };
}

describe("prepararSiHaceFalta — caso simple", () => {
  it("mintea el token de Drive y prepara el archivo", async () => {
    const llamadas: string[] = [];
    const resultado = await prepararSiHaceFalta(PUBLICACION_SIMPLE, {
      mintDriveAccessToken: async () => "token-fresco",
      drive: fakeDrive(llamadas),
      storage: fakeStorage(llamadas),
    });

    expect(resultado).toEqual({
      ok: true,
      tipoMedia: "imagen",
      storageUrl: "https://storage.example/drive-1",
    });
    expect(llamadas).toEqual([
      "drive.descargarArchivo(drive-1, token-fresco)",
      "storage.subir(drive-1, image/jpeg)",
    ]);
  });

  it("si mintear el token falla (Drive no conectado o revocado), no llama a Drive ni a Storage", async () => {
    const llamadas: string[] = [];
    const resultado = await prepararSiHaceFalta(PUBLICACION_SIMPLE, {
      mintDriveAccessToken: async () => {
        throw new Error("Drive no está conectado — andá a Configuración.");
      },
      drive: fakeDrive(llamadas),
      storage: fakeStorage(llamadas),
    });

    expect(resultado).toEqual({ ok: false, error: "Drive no está conectado — andá a Configuración." });
    expect(llamadas).toEqual([]);
  });

  it("sin driveFileId ni archivos (bug interno, nunca debería pasar): falla sin llamar a nada", async () => {
    const llamadas: string[] = [];
    const resultado = await prepararSiHaceFalta(
      { ...PUBLICACION_SIMPLE, driveFileId: null },
      { mintDriveAccessToken: async () => "token", drive: fakeDrive(llamadas), storage: fakeStorage(llamadas) }
    );

    expect(resultado.ok).toBe(false);
    expect(llamadas).toEqual([]);
  });
});

describe("prepararSiHaceFalta — carousel (ADR-0016)", () => {
  it("prepara todos los archivos, en el orden dado", async () => {
    const llamadas: string[] = [];
    const resultado = await prepararSiHaceFalta(
      {
        tipo: TipoPublicacion.post,
        driveFileId: null,
        driveResourceKey: null,
        archivos: [
          { id: "pa-1", driveFileId: "drive-1", driveResourceKey: null },
          { id: "pa-2", driveFileId: "drive-2", driveResourceKey: "rk-2" },
        ],
      },
      { mintDriveAccessToken: async () => "token-fresco", drive: fakeDrive(llamadas), storage: fakeStorage(llamadas) }
    );

    expect(resultado).toEqual({
      ok: true,
      archivos: [
        { driveFileId: "drive-1", tipoMedia: "imagen", storageUrl: "https://storage.example/drive-1" },
        { driveFileId: "drive-2", tipoMedia: "imagen", storageUrl: "https://storage.example/drive-2" },
      ],
    });
    expect(llamadas).toEqual([
      "drive.descargarArchivo(drive-1, token-fresco)",
      "storage.subir(drive-1, image/jpeg)",
      "drive.descargarArchivo(drive-2, token-fresco)",
      "storage.subir(drive-2, image/jpeg)",
    ]);
  });
});
