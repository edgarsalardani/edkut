import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./env";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 * Usa os cookies da requisição (Next 14: cookies() é síncrono).
 *
 * Em Server Components os cookies são somente leitura: o try/catch em setAll é o
 * padrão recomendado — a renovação do token é feita pelo middleware (src/middleware.ts).
 */
export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // chamado a partir de um Server Component: ignorar (o middleware renova a sessão)
        }
      },
    },
  });
}
