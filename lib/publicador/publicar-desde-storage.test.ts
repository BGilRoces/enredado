import { TipoPublicacion } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { publicarDesdeStorage } from "./publicar-desde-storage";
import type { EstadoContenedor, MetaPublishClient, StorageClient } from "./types";

function input(overrides: Partial<Parameters<typeof publicarDesdeStorage>[0]> = {}) {
  return {
    driveFileId: "drive-1",
    tipoPublicacion: TipoPublicacion.post,
    tipoMedia: "imagen" as const,
    storageUrl: "https://storage.example/drive-1",
    caption: "Un caption",
    cuenta: { igUserId: "ig-1", accessToken: "token-meta" },
    ...overrides,
  };
}

function fakeStorage(llamadas: string[] = []): StorageClient {
  return {
    async subir() {
      throw new Error("no debería subirse nada acá, ya está subido (ver ADR-0009)");
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

describe("publicarDesdeStorage — imagen", () => {
  it("camino feliz: crea contenedor, publica sin pollear, y borra el temporal", async () => {
    const llamadas: string[] = [];
    const resultado = await publicarDesdeStorage(input(), {
      meta: fakeMeta(llamadas),
      storage: fakeStorage(llamadas),
      esperar: noEsperar(),
    });

    expect(resultado).toEqual({ estado: "publicada", metaMediaId: "media-1" });
    expect(llamadas).toEqual([
      "meta.createContainer(ig-1, post, imagen)",
      "meta.publishContainer(ig-1, container-1)",
      "storage.borrar(drive-1)",
    ]);
  });

  it("si Meta rechaza el contenedor, igual borra el temporal", async () => {
    const llamadas: string[] = [];
    const resultado = await publicarDesdeStorage(input(), {
      meta: fakeMeta(llamadas, { fallaContenedor: "la cuenta no tiene permiso" }),
      storage: fakeStorage(llamadas),
      esperar: noEsperar(),
    });

    expect(resultado).toEqual({ estado: "fallida", error: "la cuenta no tiene permiso" });
    expect(llamadas).toContain("storage.borrar(drive-1)");
  });

  it("si Meta rechaza el publish final, igual borra el temporal", async () => {
    const llamadas: string[] = [];
    const resultado = await publicarDesdeStorage(input(), {
      meta: fakeMeta(llamadas, { fallaPublicar: "media aún procesando" }),
      storage: fakeStorage(llamadas),
      esperar: noEsperar(),
    });

    expect(resultado).toEqual({ estado: "fallida", error: "media aún procesando" });
    expect(llamadas).toContain("storage.borrar(drive-1)");
  });
});

describe("publicarDesdeStorage — video/Reel", () => {
  it("espera el procesamiento (varios 'en_progreso' antes de 'listo') y publica", async () => {
    const llamadas: string[] = [];
    let esperas = 0;
    const resultado = await publicarDesdeStorage(
      input({ tipoPublicacion: TipoPublicacion.reel, tipoMedia: "video" }),
      {
        meta: fakeMeta(llamadas, { estados: ["en_progreso", "en_progreso", "listo"] }),
        storage: fakeStorage(llamadas),
        esperar: async () => {
          esperas++;
        },
      }
    );

    expect(resultado).toEqual({ estado: "publicada", metaMediaId: "media-1" });
    expect(llamadas.filter((l) => l.startsWith("meta.getContainerStatus")).length).toBe(3);
    expect(esperas).toBe(2);
  });

  it("si Meta devuelve 'error' mientras procesa, nunca publica y borra el temporal", async () => {
    const llamadas: string[] = [];
    const resultado = await publicarDesdeStorage(
      input({ tipoPublicacion: TipoPublicacion.reel, tipoMedia: "video" }),
      {
        meta: fakeMeta(llamadas, { estados: ["en_progreso", "error"] }),
        storage: fakeStorage(llamadas),
        esperar: noEsperar(),
      }
    );

    expect(resultado.estado).toBe("fallida");
    expect(llamadas).not.toContain("meta.publishContainer(ig-1, container-1)");
    expect(llamadas).toContain("storage.borrar(drive-1)");
  });

  it("si nunca termina de procesar, vence por timeout, nunca publica y borra el temporal", async () => {
    const llamadas: string[] = [];
    const siempreEnProgreso = Array(50).fill("en_progreso") as EstadoContenedor[];
    const resultado = await publicarDesdeStorage(
      input({ tipoPublicacion: TipoPublicacion.reel, tipoMedia: "video" }),
      {
        meta: fakeMeta(llamadas, { estados: siempreEnProgreso }),
        storage: fakeStorage(llamadas),
        esperar: noEsperar(),
      }
    );

    expect(resultado.estado).toBe("fallida");
    expect(llamadas).not.toContain("meta.publishContainer(ig-1, container-1)");
    expect(llamadas).toContain("storage.borrar(drive-1)");
  });
});
