"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { AuthAlert, AuthNotice, AuthShell } from "@/components/AuthShell";
import { MIN_PASSWORD_LENGTH, hasValidSession, signOut, signOutEverywhere, updatePassword } from "@/lib/session";

type Status = "checking" | "ready" | "invalid" | "done";

/**
 * Tela de nova senha. Chegamos aqui pelo link do e-mail: /auth/callback já trocou o código
 * por uma sessão de recuperação (cookies) e redirecionou para cá. Sem sessão válida
 * (link expirado, já usado, aberto em outro navegador ou página aberta direto), mostramos
 * o aviso de link inválido em vez do formulário.
 */
export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    hasValidSession().then((ok) => {
      if (active) setStatus(ok ? "ready" : "invalid");
    });
    return () => {
      active = false;
    };
  }, []);

  // O link do e-mail já abriu uma sessão; ao cancelar, encerramos essa sessão (só neste navegador)
  // para o usuário não cair logado em /home sem ter definido a senha.
  async function handleCancel() {
    setLoading(true);
    await signOut();
    window.location.assign("/login");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirm) {
      setError("A confirmação não confere com a nova senha.");
      return;
    }

    setLoading(true);
    const result = await updatePassword(password);
    if (!result.ok) {
      setLoading(false);
      if (result.sessionExpired) {
        setStatus("invalid");
        return;
      }
      setError(result.error ?? "Não foi possível redefinir a senha. Tente novamente.");
      return;
    }

    // Senha trocada: encerra as sessões (inclusive a de recuperação) para o usuário
    // entrar de novo com a senha nova e para invalidar acessos com a senha antiga.
    await signOutEverywhere();
    setPassword("");
    setConfirm("");
    setLoading(false);
    setStatus("done");
  }

  if (status === "checking") {
    return (
      <AuthShell title="Redefinir senha">
        <p role="status" className="text-sm text-edkut-muted">
          Verificando seu link...
        </p>
      </AuthShell>
    );
  }

  if (status === "invalid") {
    return (
      <AuthShell title="Link inválido ou expirado">
        <AuthAlert>
          Este link de recuperação é inválido, expirou ou já foi usado. Por segurança, cada link vale uma única vez e
          por pouco tempo. Abra o link no mesmo navegador em que fez o pedido.
        </AuthAlert>
        <Link href="/forgot-password" className="edkut-btn-pink">
          Solicitar novo link
        </Link>
        <div className="mt-4 border-t border-edkut-border pt-3 text-sm">
          <Link href="/login" className="edkut-link font-bold">
            Voltar para o login
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (status === "done") {
    return (
      <AuthShell title="Senha redefinida">
        <AuthNotice>
          Pronto! Sua senha foi alterada. Entre com a nova senha. Por segurança, você foi desconectado de todos os
          dispositivos.
        </AuthNotice>
        <Link href="/login" className="edkut-btn-pink">
          Ir para o login
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Crie uma nova senha" subtitle={`Escolha uma senha com pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`}>
      {error && <AuthAlert>{error}</AuthAlert>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-semibold text-edkut-text">
          nova senha
          <input
            type="password"
            required
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="edkut-input"
            placeholder="••••••••"
          />
          <span className="text-[11px] font-normal text-edkut-muted">mínimo de {MIN_PASSWORD_LENGTH} caracteres</span>
        </label>

        <label className="flex flex-col gap-1 text-sm font-semibold text-edkut-text">
          confirmar nova senha
          <input
            type="password"
            required
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="edkut-input"
            placeholder="••••••••"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="edkut-btn-pink mt-1 self-start px-6 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "salvando..." : "Redefinir senha"}
        </button>
      </form>

      <div className="mt-4 border-t border-edkut-border pt-3 text-sm">
        <button type="button" onClick={handleCancel} disabled={loading} className="edkut-link font-bold">
          Cancelar e voltar para o login
        </button>
      </div>
    </AuthShell>
  );
}
