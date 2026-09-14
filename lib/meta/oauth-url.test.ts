import { beforeEach, describe, expect, it } from "vitest";
import { buildAuthorizeUrl } from "./oauth-url";

describe("buildAuthorizeUrl", () => {
  beforeEach(() => {
    process.env.META_APP_ID = "123456";
  });

  it("arma la URL de autorización de Facebook con los scopes necesarios", () => {
    const url = new URL(
      buildAuthorizeUrl("https://enredado.example/api/meta/callback", "estado-random")
    );

    expect(url.hostname).toBe("www.facebook.com");
    expect(url.searchParams.get("client_id")).toBe("123456");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://enredado.example/api/meta/callback"
    );
    expect(url.searchParams.get("state")).toBe("estado-random");
    expect(url.searchParams.get("scope")).toContain("instagram_content_publish");
    expect(url.searchParams.get("scope")).toContain("pages_show_list");
  });
});
