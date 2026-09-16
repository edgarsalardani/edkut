"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { login } from "@/lib/session";

const HIGHLIGHT_COMMUNITIES = [
  { emoji: "🛠️", label: "Engenharia de Software" },
  { emoji: "🎯", label: "IHC e Usabilidade" },
  { emoji: "🤖", label: "Inteligência Artificial" },
  { emoji: "🐛", label: "Meu código funciona, não sei por quê" },
  { emoji: "📚", label: "Só mais um artigo e eu começo o TCC" },
  { emoji: "🌐", label: "Desenvolvimento Web" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("edgar.salardani@edkut.com");
  const [password, setPassword] = useState("");
  const [showSignupNote, setShowSignupNote] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Protótipo mockado: o botão "entrar" sempre acessa o usuário de demonstração.
    login();
    router.push("/home");
  }

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
            <h2 className="font-heading text-base font-bold text-edkut-blue">Acesse sua conta</h2>
            <p className="mb-4 mt-1 text-xs text-edkut-muted">
              Protótipo mockado: o botão &ldquo;entrar&rdquo; acessa a conta de
              demonstração.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm font-semibold text-edkut-text">
                e-mail
                <input
                  type="email"
                  required
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="edkut-input"
                  placeholder="••••••••"
                />
              </label>

              <button type="submit" className="edkut-btn-pink mt-1 self-start px-6">
                entrar
              </button>
            </form>

            <div className="mt-4 border-t border-edkut-border pt-3 text-sm">
              <span className="text-edkut-muted">Ainda não tem conta? </span>
              <button
                onClick={() => setShowSignupNote((s) => !s)}
                className="edkut-link font-bold"
              >
                criar conta
              </button>
              {showSignupNote && (
                <p className="mt-2 text-xs text-edkut-muted">
                  O cadastro ainda não está disponível neste protótipo. Use o botão
                  &ldquo;entrar&rdquo; para explorar o edkut com a conta de
                  demonstração de Edgar Salardani.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
