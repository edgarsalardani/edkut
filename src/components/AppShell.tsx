import { ReactNode } from "react";
import { getCurrentUser } from "@/services/authService";
import { Header } from "./Header";

/**
 * Casca compartilhada de todas as páginas autenticadas (tudo exceto /login).
 * É um Server Component: busca o usuário atual (Supabase) antes de renderizar o Header.
 * O contador de notificações não aparece enquanto as notificações não forem integradas (sem números fictícios).
 */
export async function AppShell({ children }: { children: ReactNode }) {
  const currentUser = await getCurrentUser();

  return (
    <div className="min-h-screen bg-edkut-bg">
      <Header currentUser={currentUser} />
      <main className="mx-auto max-w-[1080px] px-3 py-4 sm:px-4">{children}</main>
    </div>
  );
}
