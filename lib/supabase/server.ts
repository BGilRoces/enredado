import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Cliente de Supabase para Server Components / Route Handlers, con la sesión de la cookie del request. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll llamado desde un Server Component — se ignora, el
            // middleware ya se encarga de refrescar la cookie de sesión.
          }
        },
      },
    }
  );
}
