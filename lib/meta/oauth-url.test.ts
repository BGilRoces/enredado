import { beforeEach, describe, expect, it } from "vitest";
import { buildAuthorizeUrl } from "./oauth-url";

describe("buildAuthorizeUrl", () => {
  beforeEach(() => {
    process.env.INSTAGRAM_APP_ID = "123456";
  });

  it("arma la URL de autorización de Business Login for Instagram", () => {
    const url = new URL(
      buildAuthorizeUrl("https://enredado.example/api/meta/callback", "estado-random")
    );

    expect(url.hostname).toBe("www.instagram.com");
    expect(url.pathname).toBe("/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("123456");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://enredado.example/api/meta/callback"
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe(
      "instagram_business_basic,instagram_business_content_publish"
    );
    expect(url.searchParams.get("state")).toBe("estado-random");
  });
});
