import { describe, expect, it } from "vitest";
import { tokenDeAuthorization, tokenValido } from "./autenticar";

const TOKEN = "a".repeat(40);

describe("tokenValido", () => {
  it("acepta el token configurado", () => {
    expect(tokenValido(TOKEN, TOKEN)).toBe(true);
  });

  it("rechaza un token distinto, vacío o ausente", () => {
    expect(tokenValido("b".repeat(40), TOKEN)).toBe(false);
    expect(tokenValido("", TOKEN)).toBe(false);
    expect(tokenValido(null, TOKEN)).toBe(false);
  });

  it("tolera espacios, saltos de línea o comillas de más en la env var o en el token recibido", () => {
    expect(tokenValido(TOKEN, `${TOKEN}\n`)).toBe(true);
    expect(tokenValido(TOKEN, `"${TOKEN}"`)).toBe(true);
    expect(tokenValido(` ${TOKEN} `, TOKEN)).toBe(true);
  });

  it("queda cerrado si no hay token configurado o es demasiado corto", () => {
    expect(tokenValido("corto", "corto")).toBe(false);
    expect(tokenValido("", "")).toBe(false);
    expect(tokenValido(TOKEN, undefined)).toBe(false);
  });
});

describe("tokenDeAuthorization", () => {
  it("extrae el token de un header Bearer", () => {
    expect(tokenDeAuthorization("Bearer abc123")).toBe("abc123");
    expect(tokenDeAuthorization("bearer abc123")).toBe("abc123");
  });

  it("devuelve null con otros esquemas o sin header", () => {
    expect(tokenDeAuthorization("Basic abc")).toBeNull();
    expect(tokenDeAuthorization(null)).toBeNull();
  });
});
