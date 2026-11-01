// ---------------------------------------------------------------------------
// Autenticação no NAVEGADOR (Supabase Auth). Substitui a sessão demonstrativa
// (flag em localStorage) das etapas anteriores.
//
// A sessão fica em cookies gerenciados pelo @supabase/ssr — por isso sobrevive ao
// recarregamento da página e é lida pelo middleware e pelos Server Components.
// Nenhuma senha é guardada pelo app; ela só trafega para o Supabase Auth.
// ---------------------------------------------------------------------------
import { createClient } from "@/lib/supabase/client";

export interface AuthResult {
  ok: boolean;
  /** Mensagem pronta para exibir ao usuário (pt-BR), quando ok === false. */
  error?: string;
}

export interface SignUpInput {
  name: string;
  username: string;
  email: string;
  password: string;
}

export interface SignUpResult extends AuthResult {
  /** true quando o projeto exige confirmação por e-mail (não há sessão ainda). */
  needsEmailConfirmation?: boolean;
}

export const USERNAME_RE = /^[a-z0-9._]{3,30}$/;
export const MIN_PASSWORD_LENGTH = 8;

interface AuthErrorLike {
  message?: string;
  code?: string;
  status?: number;
}

/** Traduz erros do Supabase Auth para mensagens claras em português. */
function friendlyAuthError(error: AuthErrorLike): string {
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();

  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos.";
  }
  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar: procure a mensagem de confirmação na sua caixa de entrada.";
  }
  if (code === "user_already_exists" || message.includes("already registered")) {
    return "Este e-mail já está cadastrado. Tente entrar.";
  }
  if (code === "weak_password" || message.includes("password should be")) {
    return `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (
    error.status === 429 ||
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    message.includes("rate limit")
  ) {
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.";
  }
  if (code === "signup_disabled" || message.includes("signups not allowed")) {
    return "Os cadastros estão desativados no momento.";
  }
  if (message.includes("failed to fetch") || message.includes("network")) {
    return "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.";
  }
  return "Não foi possível concluir a operação. Tente novamente.";
}

function unexpectedError(e: unknown): string {
  // Erro de configuração (variáveis ausentes) é útil para quem desenvolve; mostramos a causa.
  if (e instanceof Error && e.message.startsWith("Variáveis do Supabase ausentes")) return e.message;
  return friendlyAuthError(e as AuthErrorLike);
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { ok: false, error: friendlyAuthError(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: unexpectedError(e) };
  }
}

export async function signUp(input: SignUpInput): Promise<SignUpResult> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        // O trigger on_auth_user_created lê estes metadados para criar o perfil.
        data: { name: input.name.trim(), username: input.username.trim().toLowerCase() },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) return { ok: false, error: friendlyAuthError(error) };

    // Com a proteção contra enumeração de e-mails ligada, um e-mail já cadastrado volta
    // "com sucesso", porém sem identidades. Tratamos como "já cadastrado".
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { ok: false, error: "Este e-mail já está cadastrado. Tente entrar." };
    }

    return { ok: true, needsEmailConfirmation: !data.session };
  } catch (e) {
    return { ok: false, error: unexpectedError(e) };
  }
}

export async function signOut(): Promise<AuthResult> {
  try {
    const supabase = createClient();
    // scope "local": encerra só a sessão deste navegador (não derruba outros dispositivos).
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return { ok: false, error: friendlyAuthError(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: unexpectedError(e) };
  }
}
