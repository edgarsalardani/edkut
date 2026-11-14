import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RESET_PASSWORD_PATH, safeNextPath } from "@/lib/authRedirect";

/**
 * Destino dos links enviados por e-mail pelo Supabase Auth (fluxo PKCE):
 *  - confirmação de cadastro  -> /auth/callback?code=...                              => /home
 *  - recuperação de senha     -> /auth/callback?code=...&next=/auth/reset-password    => tela de nova senha
 *
 * Troca o `code` por uma sessão (gravada em cookies). Em caso de falha:
 *  - recuperação de senha => /forgot-password?erro=link (pedir novo link);
 *  - confirmação          => /login?erro=confirmacao.
 *
 * `next` só aceita destinos de uma lista fixa (ver lib/authRedirect.ts): sem open redirect.
 * Nenhum código/token é registrado em log.
 *
 * Opcional (modelo de e-mail "Reset Password" com {{ .TokenHash }}): também aceita
 * ?token_hash=...&type=recovery, que funciona mesmo se o link for aberto em outro navegador/aparelho.
 *
 * Esta URL precisa estar em Supabase > Authentication > URL Configuration > Redirect URLs.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = safeNextPath(searchParams.get("next"));
  const isRecovery = next === RESET_PASSWORD_PATH;

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const supabase = createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  } else if (tokenHash && type === "recovery") {
    const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${RESET_PASSWORD_PATH}`);
  }

  // Sem código, ou erro do Supabase (?error=access_denied&error_code=otp_expired...), ou troca falhou.
  if (isRecovery || (tokenHash && type === "recovery")) {
    return NextResponse.redirect(`${origin}/forgot-password?erro=link`);
  }
  return NextResponse.redirect(`${origin}/login?erro=confirmacao`);
}
