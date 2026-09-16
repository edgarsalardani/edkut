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
    <div className="flex min-h-screen flex-col bg-edkut-bg sm:flex-row">
      <section className="flex flex-1 flex-col justify-center gap-6 bg-edkut-blueDark px-6 py-10 text-white sm:px-12">
        <Logo size="lg" />
        <p className="max-w-sm text-lg italic text-edkut-bg/90">
          conectando quem aprende, ensina e compartilha tecnologia
        </p>
        <p className="max-w-md text-sm text-edkut-bg/80">
          Uma rede social para estudantes, professores, pesquisadores, egressos e
          profissionais de Computação e Tecnologia. Encontre comunidades, faça
          conexões e discuta desde arquitetura de software até por que seu código
          funciona sem você saber por quê.
        </p>

        <ul className="flex flex-wrap gap-2 pt-2">
          {HIGHLIGHT_COMMUNITIES.map((c) => (
            <li
              key={c.label}
              className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold"
            >
              <span aria-hidden="true">{c.emoji}</span>
              {c.label}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-1 items-center justify-center px-6 py-10 sm:px-12">
        <div className="edkut-card w-full max-w-sm p-6">
          <h1 className="font-heading text-lg font-bold text-edkut-blue">Entrar no edkut</h1>
          <p className="mb-5 mt-1 text-sm text-edkut-muted">
            Ainda não recomendamos notas nem frequência aqui — só conhecimento,
            comunidade e um pouco de nostalgia.
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

            <button type="submit" className="edkut-btn-pink mt-2 w-full">
              entrar
            </button>
          </form>

          <div className="mt-4 border-t border-edkut-border pt-3 text-center text-sm">
            <button
              onClick={() => setShowSignupNote((s) => !s)}
              className="edkut-link font-semibold"
            >
              criar conta
            </button>
            {showSignupNote && (
              <p className="mt-2 text-xs text-edkut-muted">
                O cadastro ainda não está disponível neste protótipo. Use o botão
                "entrar" para explorar o edkut com a conta de demonstração de
                Edgar Salardani.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
