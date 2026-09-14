import { describe, expect, it, vi } from "vitest";
import { resolveInstagramAccounts, type MetaClient } from "./resolve-accounts";

function fakeClient(overrides: Partial<MetaClient> = {}): MetaClient {
  return {
    exchangeCodeForToken: vi.fn(async () => ({
      accessToken: "short-lived-token",
    })),
    getLongLivedToken: vi.fn(async () => ({
      accessToken: "long-lived-token",
      expiresInSeconds: 60 * 24 * 60 * 60,
    })),
    getUserPages: vi.fn(async () => []),
    getPageInstagramAccount: vi.fn(async () => null),
    ...overrides,
  };
}

describe("resolveInstagramAccounts", () => {
  it("devuelve una Cuenta por cada Página con una Cuenta de Instagram vinculada", async () => {
    const client = fakeClient({
      getUserPages: vi.fn(async () => [
        { id: "page-1", name: "Biashop", access_token: "page-1-token" },
      ]),
      getPageInstagramAccount: vi.fn(async () => ({
        igUserId: "ig-1",
        igUsername: "biashop.ok",
      })),
    });

    const result = await resolveInstagramAccounts("auth-code", "https://enredado/api/meta/callback", client);

    expect(result).toEqual([
      {
        nombre: "Biashop",
        igUserId: "ig-1",
        igUsername: "biashop.ok",
        pageId: "page-1",
        accessToken: "page-1-token",
        tokenExpiraEl: expect.any(Date),
      },
    ]);
  });

  it("descarta las Páginas que no tienen ninguna Cuenta de Instagram vinculada", async () => {
    const client = fakeClient({
      getUserPages: vi.fn(async () => [
        { id: "page-1", name: "Sin IG", access_token: "t1" },
        { id: "page-2", name: "Con IG", access_token: "t2" },
      ]),
      getPageInstagramAccount: vi.fn(async (pageId: string) =>
        pageId === "page-2" ? { igUserId: "ig-2", igUsername: "con.ig" } : null
      ),
    });

    const result = await resolveInstagramAccounts("auth-code", "https://enredado/api/meta/callback", client);

    expect(result).toHaveLength(1);
    expect(result[0].pageId).toBe("page-2");
  });

  it("devuelve una lista vacía si el usuario no maneja ninguna Página", async () => {
    const client = fakeClient({ getUserPages: vi.fn(async () => []) });

    const result = await resolveInstagramAccounts("auth-code", "https://enredado/api/meta/callback", client);

    expect(result).toEqual([]);
  });

  it("propaga el error si el intercambio del code por un token falla", async () => {
    const client = fakeClient({
      exchangeCodeForToken: vi.fn(async () => {
        throw new Error("invalid_grant");
      }),
    });

    await expect(
      resolveInstagramAccounts("code-vencido", "https://enredado/api/meta/callback", client)
    ).rejects.toThrow("invalid_grant");
  });
});
