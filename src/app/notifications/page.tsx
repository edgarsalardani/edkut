import { AppShell } from "@/components/AppShell";
import { getCurrentUser } from "@/services/authService";

/**
 * Notificações: a tabela e os gatilhos existem no banco, mas esta tela ainda NÃO está integrada.
 * Até lá, mostramos um aviso honesto em vez de notificações fictícias.
 */
export default async function NotificationsPage() {
  await getCurrentUser();

  return (
    <AppShell>
      <div className="mb-4 edkut-card p-4">
        <h1 className="font-heading text-lg font-bold text-edkut-blue">notificações</h1>
        <p className="text-sm text-edkut-muted">Avisos sobre o que acontece por aqui.</p>
      </div>

      <div className="edkut-card p-6 text-center text-sm text-edkut-muted">
        As notificações ainda não estão disponíveis nesta versão do edkut. Enquanto isso, veja novas solicitações em{" "}
        <a href="/friends" className="edkut-link font-semibold">amigos</a>, recados em{" "}
        <a href="/scraps" className="edkut-link font-semibold">scraps</a> e depoimentos em{" "}
        <a href="/testimonials" className="edkut-link font-semibold">depoimentos</a>.
      </div>
    </AppShell>
  );
}
