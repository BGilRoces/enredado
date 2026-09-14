import { beforeEach, describe, expect, it } from "vitest";
import { buildAuthorizeUrl } from "./oauth-url";

describe("buildAuthorizeUrl", () => {
  beforeEach(() => {
    process.env.META_APP_ID = "123456";
    process.env.META_LOGIN_CONFIG_ID = "789012";
  });

  it("arma la URL de autorización de Facebook Login for Business con la Login Configuration", () => {
    const url = new URL(
      buildAuthorizeUrl("https://enredado.example/api/meta/callback", "estado-random")
    );

    expect(url.hostname).toBe("www.facebook.com");
    expect(url.searchParams.get("client_id")).toBe("123456");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://enredado.example/api/meta/callback"
    );
    expect(url.searchParams.get("state")).toBe("estado-random");
    expect(url.searchParams.get("config_id")).toBe("789012");
    expect(url.searchParams.get("response_type")).toBe("code");
  });
});
