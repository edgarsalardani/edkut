import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Destino do link do e-mail de confirmação (fluxo PKCE do Supabase Auth).
 * Troca o `code` por uma sessão (gravada em cookies) e envia o usuário para /home.
 * Em caso de falha, volta para /login com um indicador de erro.
 *
 * Esta URL precisa estar em Supabase > Authentication > URL Configuration > Redirect URLs.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/home`);
    }
  }

  return NextResponse.redirect(`${origin}/login?erro=confirmacao`);
}
