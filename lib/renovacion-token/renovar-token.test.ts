import { describe, expect, it, vi } from "vitest";
import { renovarToken } from "./renovar-token";
import type { MetaClient } from "@/lib/meta/resolve-accounts";

function fakeMetaClient(opts: { falla?: string } = {}): Pick<MetaClient, "getLongLivedToken"> {
  return {
    async getLongLivedToken(shortLivedToken) {
      if (opts.falla) throw new Error(opts.falla);
      return { accessToken: `renovado-${shortLivedToken}`, expiresInSeconds: 60 * 24 * 60 * 60 };
    },
  };
}

describe("renovarToken", () => {
  it("camino feliz: pide un token nuevo a Meta y calcula el nuevo vencimiento", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-14T00:00:00Z"));

    const resultado = await renovarToken("token-actual", fakeMetaClient());

    expect(resultado).toEqual({
      ok: true,
      accessToken: "renovado-token-actual",
      tokenExpiraEl: new Date("2026-11-13T00:00:00Z"),
    });

    vi.useRealTimers();
  });

  it("si Meta rechaza la renovación, devuelve el motivo sin tirar", async () => {
    const resultado = await renovarToken("token-actual", fakeMetaClient({ falla: "Error validating access token" }));
    expect(resultado).toEqual({ ok: false, error: "Error validating access token" });
  });
});
