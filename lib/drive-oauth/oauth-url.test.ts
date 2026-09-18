import { beforeEach, describe, expect, it } from "vitest";
import { buildAuthorizeUrl } from "./oauth-url";

describe("buildAuthorizeUrl", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "client-123.apps.googleusercontent.com";
  });

  it("arma la URL de consentimiento offline de Google", () => {
    const url = new URL(
      buildAuthorizeUrl("https://enredado.example/api/drive/callback", "estado-random")
    );

    expect(url.hostname).toBe("accounts.google.com");
    expect(url.pathname).toBe("/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("client-123.apps.googleusercontent.com");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://enredado.example/api/drive/callback"
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/drive.readonly");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("estado-random");
  });
});
