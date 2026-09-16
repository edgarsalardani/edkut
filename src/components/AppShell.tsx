import { ReactNode } from "react";
import { getCurrentUser } from "@/services/userService";
import { getNotifications } from "@/services/notificationService";
import { Header } from "./Header";

/**
 * Casca compartilhada de todas as páginas autenticadas (tudo exceto /login).
 * É um Server Component: busca o usuário atual e as notificações direto dos
 * services (hoje mocks, futuramente API) antes de renderizar o Header.
 */
export async function AppShell({ children }: { children: ReactNode }) {
  const currentUser = await getCurrentUser();
  const notifications = await getNotifications(currentUser.id);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-edkut-bg">
      <Header currentUser={currentUser} unreadCount={unreadCount} />
      <main className="mx-auto max-w-[1080px] px-3 py-4 sm:px-4">{children}</main>
    </div>
  );
}
