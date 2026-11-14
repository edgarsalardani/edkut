import { AppShell } from "@/components/AppShell";
import { EditProfileForm } from "@/components/EditProfileForm";
import { getCurrentUser } from "@/services/authService";

/** /profile/edit — sempre edita o perfil do PRÓPRIO usuário autenticado (nenhum id vem da URL). */
export default async function EditProfilePage() {
  const currentUser = await getCurrentUser();

  return (
    <AppShell>
      <EditProfileForm user={currentUser} />
    </AppShell>
  );
}
