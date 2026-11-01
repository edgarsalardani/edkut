import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./env";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/** Rotas acessíveis sem login. Todo o resto exige sessão. */
const PUBLIC_PATHS = ["/login", "/auth/callback"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function redirectTo(request: NextRequest, pathname: string, from: NextResponse): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const response = NextResponse.redirect(url);
  // preserva cookies de sessão renovados (senão o token renovado se perderia no redirect)
  from.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  return response;
}

/**
 * Executa em TODA requisição (ver matcher em src/middleware.ts):
 *  1) valida o usuário com o servidor do Supabase Auth (getUser) e renova o token, se preciso;
 *  2) sem sessão em rota protegida => /login;
 *  3) com sessão em /login ou em / => /home.
 *
 * Nunca use getSession() aqui para decidir acesso: ele não valida o JWT no servidor.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request });

  const { url, anonKey } = getSupabaseEnv();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    return redirectTo(request, "/login", supabaseResponse);
  }
  if (user && (pathname === "/login" || pathname === "/")) {
    return redirectTo(request, "/home", supabaseResponse);
  }

  return supabaseResponse;
}
