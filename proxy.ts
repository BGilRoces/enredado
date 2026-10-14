import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { APP_SLUG } from "@/lib/app-config";
import { decideAuthRedirect, isSelfAuthenticated } from "@/lib/auth/decide-redirect";

export async function proxy(request: NextRequest) {
  // Solo `next dev`: sin login en localhost. En `next build`/`start` NODE_ENV es "production".
  if (process.env.NODE_ENV === "development") {
    if (request.nextUrl.pathname === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  // El servidor MCP valida su propio token (ADR-0017): no gastar un round-trip
  // a Supabase Auth en cada request para una sesión que no usa.
  if (isSelfAuthenticated(request.nextUrl.pathname)) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const decision = decideAuthRedirect({
    hasSession: user !== null,
    belongsToThisApp: user?.app_metadata?.app === APP_SLUG,
    pathname: request.nextUrl.pathname,
  });

  switch (decision.action) {
    case "json-401":
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    case "redirect": {
      const url = request.nextUrl.clone();
      url.pathname = decision.to;
      return NextResponse.redirect(url);
    }
    case "allow":
      return supabaseResponse;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
