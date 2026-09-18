import { describe, expect, it } from "vitest";
import { esLinkDeCarpeta, parsearDriveLink } from "./parsear-drive-file-id";

describe("parsearDriveLink", () => {
  it("link de compartir estándar (/file/d/<id>/view)", () => {
    expect(parsearDriveLink("https://drive.google.com/file/d/abc123XYZ/view?usp=sharing")).toEqual({
      driveFileId: "abc123XYZ",
      resourceKey: undefined,
    });
  });

  it("link con resourceKey (compartido por link, no directo)", () => {
    expect(
      parsearDriveLink("https://drive.google.com/file/d/abc123XYZ/view?usp=sharing&resourcekey=0-abc")
    ).toEqual({ driveFileId: "abc123XYZ", resourceKey: "0-abc" });
  });

  it("link con ?id=", () => {
    expect(parsearDriveLink("https://drive.google.com/open?id=abc123XYZ")).toEqual({
      driveFileId: "abc123XYZ",
      resourceKey: undefined,
    });
  });

  it("link que no es de un archivo de Drive: null", () => {
    expect(parsearDriveLink("https://drive.google.com/drive/folders/abc123")).toBeNull();
  });

  it("no es una URL válida: null", () => {
    expect(parsearDriveLink("no es un link")).toBeNull();
  });
});

describe("esLinkDeCarpeta", () => {
  it("detecta un link de carpeta con usp=sharing", () => {
    expect(esLinkDeCarpeta("https://drive.google.com/drive/folders/abc123?usp=sharing")).toBe(true);
  });

  it("detecta un link de carpeta con usp=drive_link", () => {
    expect(esLinkDeCarpeta("https://drive.google.com/drive/folders/abc123?usp=drive_link")).toBe(true);
  });

  it("un link de archivo no es una carpeta", () => {
    expect(esLinkDeCarpeta("https://drive.google.com/file/d/abc123/view")).toBe(false);
  });

  it("no es una URL válida: false", () => {
    expect(esLinkDeCarpeta("no es un link")).toBe(false);
  });
});
