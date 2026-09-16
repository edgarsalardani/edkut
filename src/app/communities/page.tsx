import { AppShell } from "@/components/AppShell";
import { CommunitiesPageClient } from "@/components/CommunitiesPageClient";
import { getCurrentUser } from "@/services/userService";
import { getAllCommunities } from "@/services/communityService";

export default async function CommunitiesPage() {
  const currentUser = await getCurrentUser();
  const communities = await getAllCommunities();

  return (
    <AppShell>
      <div className="mb-4 edkut-card p-4">
        <h1 className="font-heading text-lg font-bold text-edkut-blue">comunidades</h1>
        <p className="text-sm text-edkut-muted">
          O coração do edkut. Encontre gente discutindo o que você gosta — de arquitetura de software a piadas de
          quem sobreviveu ao TCC.
        </p>
      </div>

      <CommunitiesPageClient initialCommunities={communities} currentUser={currentUser} />
    </AppShell>
  );
}
