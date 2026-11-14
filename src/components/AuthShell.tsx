import { ReactNode } from "react";
import { Logo } from "@/components/Logo";

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/**
 * Moldura das telas de recuperação de senha: mesmo fundo, logo e painel branco
 * com borda fina usados na página de login (só que numa coluna única e estreita).
 */
export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="min-h-screen bg-edkut-bg px-4 py-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-md flex-col items-center">
        <Logo size="lg" withSlogan />

        <div className="mt-6 w-full rounded-edkut border border-edkut-border bg-edkut-card p-5">
          <h1 className="font-heading text-base font-bold text-edkut-blue">{title}</h1>
          {subtitle && <p className="mb-4 mt-1 text-xs text-edkut-muted">{subtitle}</p>}
          {!subtitle && <div className="mb-4" />}
          {children}
        </div>
      </div>
    </div>
  );
}

export function AuthAlert({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="mb-3 rounded-edkut border border-edkut-pink bg-edkut-pinkSoft px-2.5 py-1.5 text-xs text-edkut-pinkDark"
    >
      {children}
    </p>
  );
}

export function AuthNotice({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="mb-3 rounded-edkut border border-edkut-borderStrong bg-edkut-blueSoft px-2.5 py-1.5 text-xs text-edkut-blue"
    >
      {children}
    </p>
  );
}
