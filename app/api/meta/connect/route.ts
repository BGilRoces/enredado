import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { buildAuthorizeUrl } from "@/lib/meta/oauth-url";
import { APP_URL, OAUTH_STATE_COOKIE } from "@/lib/meta/config";

export async function GET() {
  const state = randomBytes(16).toString("hex");
  const redirectUri = new URL("/api/meta/callback", APP_URL).toString();

  const response = NextResponse.redirect(buildAuthorizeUrl(redirectUri, state));
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });
  return response;
}
