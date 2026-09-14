import { beforeEach, describe, expect, it } from "vitest";
import { encryptToken, decryptToken } from "./token-cipher";

describe("token-cipher", () => {
  beforeEach(() => {
    // 32 bytes en base64, generada solo para el test.
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  });

  it("descifra exactamente lo que se cifró", () => {
    const original = "EAABw...token-de-meta...";
    const cipher = encryptToken(original);
    expect(decryptToken(cipher)).toBe(original);
  });

  it("el texto cifrado no contiene el token en claro", () => {
    const original = "EAABw-super-secreto";
    const cipher = encryptToken(original);
    expect(cipher).not.toContain(original);
  });

  it("cifrar el mismo valor dos veces da resultados distintos (IV al azar)", () => {
    const original = "mismo-token";
    expect(encryptToken(original)).not.toBe(encryptToken(original));
  });

  it("rechaza un texto cifrado manipulado en vez de devolver basura", () => {
    const cipher = encryptToken("valor-original");
    const tampered = cipher.slice(0, -4) + "aaaa";
    expect(() => decryptToken(tampered)).toThrow();
  });

  it("tira un error claro si falta TOKEN_ENCRYPTION_KEY", () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(() => encryptToken("x")).toThrow(/TOKEN_ENCRYPTION_KEY/);
  });
});
