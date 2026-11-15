import { AppShell } from "@/components/AppShell";
import { CommunitiesPageClient } from "@/components/CommunitiesPageClient";
import { getCurrentUser } from "@/services/authService";
import { getCommunitiesData } from "@/services/communityService";

export default async function CommunitiesPage() {
  const currentUser = await getCurrentUser();
  const data = await getCommunitiesData(currentUser.id);

  return (
    <AppShell>
      <div className="mb-4 edkut-card p-4">
        <h1 className="font-heading text-lg font-bold text-edkut-blue">comunidades</h1>
        <p className="text-sm text-edkut-muted">Espaços para conversar sobre o que você gosta. Encontre, entre ou crie a sua.</p>
      </div>

      <CommunitiesPageClient
        initialCommunities={data.communities}
        categories={data.categories}
        myRoles={data.myRoles}
        myPendingIds={data.myPendingIds}
        currentUser={currentUser}
        loadError={data.error}
        migrationMissing={data.migrationMissing}
      />
    </AppShell>
  );
}
