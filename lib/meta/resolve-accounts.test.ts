import { describe, expect, it, vi } from "vitest";
import { resolveInstagramAccount, type MetaClient } from "./resolve-accounts";

function fakeClient(overrides: Partial<MetaClient> = {}): MetaClient {
  return {
    exchangeCodeForToken: vi.fn(async () => ({
      accessToken: "short-lived-token",
    })),
    getLongLivedToken: vi.fn(async () => ({
      accessToken: "long-lived-token",
      expiresInSeconds: 60 * 24 * 60 * 60,
    })),
    refreshLongLivedToken: vi.fn(async () => ({
      accessToken: "long-lived-token",
      expiresInSeconds: 60 * 24 * 60 * 60,
    })),
    getInstagramAccount: vi.fn(async () => ({
      igUserId: "ig-1",
      igUsername: "biashop.ok",
    })),
    ...overrides,
  };
}

describe("resolveInstagramAccount", () => {
  it("resuelve la Cuenta de Instagram logueada directo (sin Página de Facebook, ver ADR-0012)", async () => {
    const client = fakeClient();

    const result = await resolveInstagramAccount("auth-code", "https://enredado/api/meta/callback", client);

    expect(result).toEqual({
      nombre: "biashop.ok",
      igUserId: "ig-1",
      igUsername: "biashop.ok",
      accessToken: "long-lived-token",
      tokenExpiraEl: expect.any(Date),
    });
  });

  it("propaga el error si el intercambio del code por un token falla", async () => {
    const client = fakeClient({
      exchangeCodeForToken: vi.fn(async () => {
        throw new Error("invalid_grant");
      }),
    });

    await expect(
      resolveInstagramAccount("code-vencido", "https://enredado/api/meta/callback", client)
    ).rejects.toThrow("invalid_grant");
  });

  it("propaga el error si la cuenta no es Business/Creator (getInstagramAccount falla)", async () => {
    const client = fakeClient({
      getInstagramAccount: vi.fn(async () => {
        throw new Error("cuenta personal, no profesional");
      }),
    });

    await expect(
      resolveInstagramAccount("auth-code", "https://enredado/api/meta/callback", client)
    ).rejects.toThrow("cuenta personal, no profesional");
  });
});
