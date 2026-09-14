import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY no está configurado (ver .env.example)"
    );
  }
  const buf = Buffer.from(key, "base64");
  if (buf.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY debe decodificar a 32 bytes (base64 de una clave AES-256)");
  }
  return buf;
}

/** Cifra un token de Meta para guardarlo en la base (ver ADR-0007). */
export function encryptToken(plainText: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, encrypted]
    .map((part) => part.toString("base64"))
    .join(".");
}

/** Descifra un valor producido por encryptToken. Tira si fue manipulado. */
export function decryptToken(cipherText: string): string {
  const [ivB64, tagB64, dataB64] = cipherText.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Formato de token cifrado inválido");
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
