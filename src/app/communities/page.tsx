import { AppShell } from "@/components/AppShell";
import { getCurrentUser } from "@/services/authService";

/**
 * Comunidades: as tabelas existem no banco, mas esta tela ainda NÃO está integrada.
 * Sem comunidades fictícias: mostramos um aviso honesto até a etapa de comunidades.
 */
export default async function CommunitiesPage() {
  await getCurrentUser();

  return (
    <AppShell>
      <div className="mb-4 edkut-card p-4">
        <h1 className="font-heading text-lg font-bold text-edkut-blue">comunidades</h1>
        <p className="text-sm text-edkut-muted">Espaços para conversar sobre o que você gosta.</p>
      </div>

      <div className="edkut-card p-6 text-center text-sm text-edkut-muted">
        As comunidades ainda não estão disponíveis nesta versão do edkut. Por enquanto, encontre pessoas na{" "}
        <a href="/search" className="edkut-link font-semibold">busca</a> e troque recados com seus amigos.
      </div>
    </AppShell>
  );
}
