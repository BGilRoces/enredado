import { describe, expect, it } from "vitest";
import { parsearDriveFolderId, parsearDriveLink } from "./parsear-drive-file-id";

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

describe("parsearDriveFolderId", () => {
  it("extrae el id de una carpeta, ignorando la query", () => {
    expect(parsearDriveFolderId("https://drive.google.com/drive/folders/abc123?usp=sharing")).toBe(
      "abc123"
    );
  });

  it("extrae el id de una carpeta con usp=drive_link", () => {
    expect(parsearDriveFolderId("https://drive.google.com/drive/folders/abc123?usp=drive_link")).toBe(
      "abc123"
    );
  });

  it("un link de archivo no es una carpeta: null", () => {
    expect(parsearDriveFolderId("https://drive.google.com/file/d/abc123/view")).toBeNull();
  });

  it("no es una URL válida: null", () => {
    expect(parsearDriveFolderId("no es un link")).toBeNull();
  });
});
