"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { AuthAlert, AuthNotice, AuthShell } from "@/components/AuthShell";
import { requestPasswordReset } from "@/lib/session";

/** Mesma espera do Supabase entre dois e-mails para o mesmo endereço (60 s por padrão). */
const RESEND_COOLDOWN_SECONDS = 60;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // /auth/callback manda para cá (?erro=link) quando o link de recuperação é inválido/expirado.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("erro") === "link") {
      setError("O link de recuperação é inválido, expirou ou já foi usado. Peça um novo link abaixo.");
    }
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading || cooldown > 0) return;
    setError(null);

    const clean = email.trim();
    if (!clean) {
      setError("Informe o e-mail da sua conta.");
      return;
    }

    setLoading(true);
    const result = await requestPasswordReset(clean);
    setLoading(false);

    if (!result.ok) {
      setSent(false);
      setError(result.error ?? "Não foi possível enviar o link agora. Tente novamente.");
      return;
    }
    // Mensagem única, independente de o e-mail existir ou não.
    setSent(true);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  return (
    <AuthShell
      title="Esqueceu sua senha?"
      subtitle="Informe o e-mail da sua conta e enviaremos um link para você criar uma nova senha."
    >
      {error && <AuthAlert>{error}</AuthAlert>}
      {sent && (
        <AuthNotice>
          Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha. Confira também a caixa de
          spam. O link expira em pouco tempo e só pode ser usado uma vez.
        </AuthNotice>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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

        <button
          type="submit"
          disabled={loading || cooldown > 0}
          className="edkut-btn-pink mt-1 self-start px-6 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? "enviando..."
            : cooldown > 0
              ? `reenviar em ${cooldown}s`
              : sent
                ? "enviar novamente"
                : "Enviar link de recuperação"}
        </button>
      </form>

      <div className="mt-4 border-t border-edkut-border pt-3 text-sm">
        <Link href="/login" className="edkut-link font-bold">
          Voltar para o login
        </Link>
      </div>
    </AuthShell>
  );
}
