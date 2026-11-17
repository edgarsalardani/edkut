import { AppShell } from "@/components/AppShell";
import { EditProfileForm } from "@/components/EditProfileForm";
import { ProfileExtrasForm } from "@/components/ProfileExtrasForm";
import { getCurrentUser } from "@/services/authService";
import { getProfileExtras } from "@/services/profileClassicService";

/** /profile/edit — sempre edita o perfil do PRÓPRIO usuário autenticado (nenhum id vem da URL). */
export default async function EditProfilePage() {
  const currentUser = await getCurrentUser();
  const { extras, migrationMissing } = await getProfileExtras(currentUser.id);

  return (
    <AppShell>
      <div className="flex flex-col gap-3">
        <EditProfileForm user={currentUser} />
        <div className="mx-auto w-full max-w-3xl">
          <ProfileExtrasForm userId={currentUser.id} initial={extras} migrationMissing={migrationMissing} />
        </div>
      </div>
    </AppShell>
  );
}
