import { AppShell } from "@/components/AppShell";
import { ProfileScrapsSection } from "@/components/ProfileScrapsSection";
import { getCurrentUser } from "@/services/userService";
import { getScraps } from "@/services/scrapService";

export default async function ScrapsPage() {
  const currentUser = await getCurrentUser();
  const scraps = await getScraps(currentUser.id);

  return (
    <AppShell>
      <div className="mb-4 edkut-card p-4">
        <h1 className="font-heading text-lg font-bold text-edkut-blue">scraps</h1>
        <p className="text-sm text-edkut-muted">Recados públicos deixados no seu perfil por amigos e colegas.</p>
      </div>

      <ProfileScrapsSection
        profileOwner={currentUser}
        currentUser={currentUser}
        initialScraps={scraps}
        isOwnProfile={false}
        previewCount={scraps.length}
      />
    </AppShell>
  );
}
