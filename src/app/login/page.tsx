"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { MIN_PASSWORD_LENGTH, USERNAME_RE, signIn, signUp } from "@/lib/session";

const HIGHLIGHT_COMMUNITIES = [
  { emoji: "🛠️", label: "Engenharia de Software" },
  { emoji: "🎯", label: "IHC e Usabilidade" },
  { emoji: "🤖", label: "Inteligência Artificial" },
  { emoji: "🐛", label: "Meu código funciona, não sei por quê" },
  { emoji: "📚", label: "Só mais um artigo e eu começo o TCC" },
  { emoji: "🌐", label: "Desenvolvimento Web" },
];

type Mode = "entrar" | "cadastrar";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("entrar");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // /auth/callback redireciona para /login?erro=confirmacao quando o link do e-mail falha.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("erro") === "confirmacao") {
      setError("Não foi possível confirmar seu e-mail. O link pode ter expirado: entre ou cadastre-se novamente.");
    }
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setInfo(null);
    setPassword("");
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    const result = await signIn(email, password);
    if (!result.ok) {
      setError(result.error ?? "Não foi possível entrar.");
      setLoading(false);
      return;
    }
    // Mantém "loading" até a navegação terminar (evita duplo envio).
    router.push("/home");
    router.refresh();
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const cleanName = name.trim();
    const cleanUsername = username.trim().toLowerCase();
    if (cleanName.length < 2 || cleanName.length > 80) {
      setError("Informe seu nome (de 2 a 80 caracteres).");
      return;
    }
    if (!USERNAME_RE.test(cleanUsername)) {
      setError("O username deve ter de 3 a 30 caracteres: letras minúsculas, números, ponto ou _ (sem espaços).");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    setLoading(true);
    const result = await signUp({ name: cleanName, username: cleanUsername, email, password });
    if (!result.ok) {
      setError(result.error ?? "Não foi possível criar a conta.");
      setLoading(false);
      return;
    }

    if (result.needsEmailConfirmation) {
      // Cadastro feito; falta confirmar o e-mail. Volta para "entrar" com o e-mail preenchido.
      setMode("entrar");
      setPassword("");
      setLoading(false);
      setInfo(
        "Conta criada! Enviamos um e-mail de confirmação. Clique no link da mensagem para ativar a conta e depois entre."
      );
      return;
    }

    // Projeto sem confirmação de e-mail: já há sessão.
    router.push("/home");
    router.refresh();
  }

  const isSignup = mode === "cadastrar";

  return (
    <div className="min-h-screen bg-edkut-bg px-4 py-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center">
        <Logo size="lg" withSlogan />

        <div className="mt-6 grid w-full grid-cols-1 gap-4 sm:grid-cols-[1.3fr_1fr] sm:items-start">
          {/* Área esquerda — boas-vindas */}
          <div className="border border-edkut-border bg-edkut-card rounded-edkut p-5">
            <h1 className="font-heading text-lg font-bold text-edkut-blue">Bem-vindo ao edkut!</h1>
            <p className="mt-2 text-sm text-edkut-text">
              O edkut conecta estudantes, professores, pesquisadores, egressos e
              profissionais interessados em Computação e Tecnologia. Encontre
              comunidades, participe de discussões e faça conexões com quem também
              vive código, IHC, IA e um pouco de nostalgia.
            </p>

            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-edkut-muted">
              comunidades em destaque
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {HIGHLIGHT_COMMUNITIES.map((c) => (
                <li key={c.label} className="edkut-tag flex items-center gap-1">
                  <span aria-hidden="true">{c.emoji}</span>
                  {c.label}
                </li>
              ))}
            </ul>
          </div>

          {/* Área direita — acesso */}
          <div className="border border-edkut-border bg-edkut-card rounded-edkut p-5">
            <h2 className="font-heading text-base font-bold text-edkut-blue">
              {isSignup ? "Crie sua conta" : "Acesse sua conta"}
            </h2>
            <p className="mb-4 mt-1 text-xs text-edkut-muted">
              {isSignup
                ? "Preencha os dados abaixo para entrar no edkut."
                : "Entre com o e-mail e a senha cadastrados."}
            </p>

            {error && (
              <p
                role="alert"
                className="mb-3 rounded-edkut border border-edkut-pink bg-edkut-pinkSoft px-2.5 py-1.5 text-xs text-edkut-pinkDark"
              >
                {error}
              </p>
            )}
            {info && (
              <p
                role="status"
                className="mb-3 rounded-edkut border border-edkut-borderStrong bg-edkut-blueSoft px-2.5 py-1.5 text-xs text-edkut-blue"
              >
                {info}
              </p>
            )}

            <form onSubmit={isSignup ? handleSignUp : handleLogin} className="flex flex-col gap-3">
              {isSignup && (
                <>
                  <label className="flex flex-col gap-1 text-sm font-semibold text-edkut-text">
                    nome
                    <input
                      type="text"
                      required
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="edkut-input"
                      placeholder="Seu nome"
                      maxLength={80}
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-sm font-semibold text-edkut-text">
                    username
                    <input
                      type="text"
                      required
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase())}
                      className="edkut-input"
                      placeholder="seu.username"
                      maxLength={30}
                    />
                    <span className="text-[11px] font-normal text-edkut-muted">
                      3 a 30 caracteres: letras minúsculas, números, ponto ou _
                    </span>
                  </label>
                </>
              )}

              <label className="flex flex-col gap-1 text-sm font-semibold text-edkut-text">
                e-mail
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="edkut-input"
                  placeholder="voce@exemplo.com"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-semibold text-edkut-text">
                senha
                <input
                  type="password"
                  required
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  minLength={isSignup ? MIN_PASSWORD_LENGTH : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="edkut-input"
                  placeholder="••••••••"
                />
                {isSignup && (
                  <span className="text-[11px] font-normal text-edkut-muted">
                    mínimo de {MIN_PASSWORD_LENGTH} caracteres
                  </span>
                )}
              </label>

              <button
                type="submit"
                disabled={loading}
                className="edkut-btn-pink mt-1 self-start px-6 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (isSignup ? "criando conta..." : "entrando...") : isSignup ? "criar conta" : "entrar"}
              </button>
            </form>

            <div className="mt-4 border-t border-edkut-border pt-3 text-sm">
              {isSignup ? (
                <>
                  <span className="text-edkut-muted">Já tem conta? </span>
                  <button type="button" onClick={() => switchMode("entrar")} className="edkut-link font-bold">
                    entrar
                  </button>
                </>
              ) : (
                <>
                  <span className="text-edkut-muted">Ainda não tem conta? </span>
                  <button type="button" onClick={() => switchMode("cadastrar")} className="edkut-link font-bold">
                    criar conta
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
