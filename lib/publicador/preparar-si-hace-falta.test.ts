import { TipoPublicacion } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { prepararSiHaceFalta } from "./preparar-si-hace-falta";
import type { DriveClient, StorageClient } from "./types";

const PUBLICACION = {
  id: "pub-1",
  tipo: TipoPublicacion.post,
  idea: { driveFileId: "drive-1", driveResourceKey: null },
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

describe("prepararSiHaceFalta", () => {
  it("mintea el token de Drive y prepara el archivo de la Idea", async () => {
    const llamadas: string[] = [];
    const resultado = await prepararSiHaceFalta(PUBLICACION, {
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
    const resultado = await prepararSiHaceFalta(PUBLICACION, {
      mintDriveAccessToken: async () => {
        throw new Error("Drive no está conectado — andá a Configuración.");
      },
      drive: fakeDrive(llamadas),
      storage: fakeStorage(llamadas),
    });

    expect(resultado).toEqual({ ok: false, error: "Drive no está conectado — andá a Configuración." });
    expect(llamadas).toEqual([]);
  });

  it("si la Publicación no tiene idea.driveFileId, falla sin llamar a nada (bug interno, nunca debería pasar)", async () => {
    const llamadas: string[] = [];
    const resultado = await prepararSiHaceFalta(
      { ...PUBLICACION, idea: { driveFileId: null, driveResourceKey: null } },
      { mintDriveAccessToken: async () => "token", drive: fakeDrive(llamadas), storage: fakeStorage(llamadas) }
    );

    expect(resultado.ok).toBe(false);
    expect(llamadas).toEqual([]);
  });
});
