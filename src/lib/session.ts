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

// ---------------------------------------------------------------------------
// Recuperação de senha ("Esqueci minha senha")
//
// Fluxo (PKCE, tudo pelo Supabase Auth — o app nunca vê nem guarda a senha):
//   1. requestPasswordReset(email) -> Supabase envia o e-mail com o link;
//   2. o link abre /auth/callback?code=...&next=/auth/reset-password, que troca o código
//      por uma sessão de recuperação (cookies) e redireciona para a tela de nova senha;
//   3. updatePassword(nova) -> auth.updateUser({ password }).
// Nenhum token é lido, impresso ou guardado por este código.
// ---------------------------------------------------------------------------

export interface PasswordResetRequestResult extends AuthResult {
  /** true quando a falha foi só de limite de envios (não revela nada sobre a conta). */
  rateLimited?: boolean;
}

/**
 * Pede o e-mail de recuperação. Por segurança NÃO revela se o e-mail existe:
 * só devolve erro para problemas que independem da conta (limite de envios, rede,
 * configuração). Qualquer outro retorno do Supabase é tratado como "pedido aceito".
 */
export async function requestPasswordReset(email: string): Promise<PasswordResetRequestResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      // O callback troca o código por sessão e segue para a tela de nova senha.
      // Esta URL precisa estar em Authentication > URL Configuration > Redirect URLs.
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    });
    if (!error) return { ok: true };

    const e = error as AuthErrorLike;
    const message = (e.message ?? "").toLowerCase();
    const rateLimited =
      e.status === 429 ||
      e.code === "over_email_send_rate_limit" ||
      e.code === "over_request_rate_limit" ||
      message.includes("rate limit");
    if (rateLimited) {
      return {
        ok: false,
        rateLimited: true,
        error: "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.",
      };
    }
    if (message.includes("failed to fetch") || message.includes("network")) {
      return {
        ok: false,
        error: "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.",
      };
    }
    // Demais erros (inclusive "usuário não encontrado", se o projeto os devolver):
    // resposta idêntica à de sucesso, para não permitir descobrir quais e-mails existem.
    return { ok: true };
  } catch (e) {
    return { ok: false, error: unexpectedError(e) };
  }
}

/** Há uma sessão válida (validada no servidor do Supabase)? É o que permite trocar a senha. */
export async function hasValidSession(): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.getUser();
    return !error && !!data.user;
  } catch {
    return false;
  }
}

export interface UpdatePasswordResult extends AuthResult {
  /** true quando o link/sessão de recuperação expirou: é preciso pedir um novo. */
  sessionExpired?: boolean;
}

function weakPasswordMessage(error: AuthErrorLike & { weak_password?: { reasons?: string[] } }): string {
  const reasons = error.weak_password?.reasons ?? [];
  const parts: string[] = [];
  if (reasons.includes("length")) parts.push(`ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres`);
  if (reasons.includes("characters")) {
    parts.push("misturar letras maiúsculas, minúsculas, números e/ou símbolos, conforme as regras do projeto");
  }
  if (reasons.includes("pwned")) parts.push("não ser uma senha já vazada em outros sites");
  if (parts.length === 0) {
    return `A senha não atende às regras de segurança. Use pelo menos ${MIN_PASSWORD_LENGTH} caracteres, misturando letras, números e símbolos.`;
  }
  return `A senha precisa ${parts.join("; ")}.`;
}

/** Define a nova senha do usuário da sessão atual (a de recuperação, vinda do link do e-mail). */
export async function updatePassword(newPassword: string): Promise<UpdatePasswordResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error) return { ok: true };

    const e = error as AuthErrorLike & { weak_password?: { reasons?: string[] } };
    const message = (e.message ?? "").toLowerCase();

    if (e.code === "same_password" || message.includes("different from the old password")) {
      return { ok: false, error: "A nova senha precisa ser diferente da senha atual." };
    }
    if (e.code === "weak_password" || message.includes("password should be") || message.includes("weak")) {
      return { ok: false, error: weakPasswordMessage(e) };
    }
    if (
      e.code === "session_not_found" ||
      e.code === "session_expired" ||
      e.code === "refresh_token_not_found" ||
      e.status === 401 ||
      message.includes("auth session missing") ||
      message.includes("jwt expired")
    ) {
      return {
        ok: false,
        sessionExpired: true,
        error: "O link de recuperação expirou ou já foi usado. Solicite um novo link.",
      };
    }
    return { ok: false, error: friendlyAuthError(e) };
  } catch (e) {
    return { ok: false, error: unexpectedError(e) };
  }
}

/**
 * Encerra TODAS as sessões do usuário (scope "global"), em todos os dispositivos.
 * Usado logo depois de redefinir a senha: quem tinha a senha antiga (ou um token roubado)
 * perde o acesso. Se falhar, ao menos encerra a sessão deste navegador.
 */
export async function signOutEverywhere(): Promise<void> {
  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) await supabase.auth.signOut({ scope: "local" });
  } catch {
    /* sem ação: o usuário será mandado para /login de qualquer forma */
  }
}
