import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ProfileCommunitiesBox } from "@/components/ProfileCommunitiesBox";
import { getCurrentUser, getProfileUserById } from "@/services/authService";
import { getProfileCommunities } from "@/services/profileClassicService";

/** /profile/[id]/communities — todas as comunidades de que a pessoa participa (dados reais). */
export default async function ProfileCommunitiesPage({ params }: { params: { id: string } }) {
  const currentUser = await getCurrentUser();
  const profileUser = await getProfileUserById(params.id);
  if (!profileUser) notFound();
  const { items, total, error } = await getProfileCommunities(profileUser.id, 200);
  const own = profileUser.id === currentUser.id;
  const firstName = profileUser.name.split(" ")[0];

  return (
    <AppShell>
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        <p className="text-xs">
          <Link href={`/profile/${profileUser.id}`} className="edkut-link font-semibold">← voltar ao perfil de {profileUser.name}</Link>
        </p>
        {error && (
          <p role="alert" className="rounded-edkut border border-edkut-pink bg-edkut-pinkSoft px-3 py-2 text-sm text-edkut-pinkDark">
            Não foi possível carregar as comunidades agora. Atualize a página.
          </p>
        )}
        <ProfileCommunitiesBox
          communities={items}
          total={total}
          viewAllHref="/communities"
          columns={4}
          emptyMessage={own ? "Você ainda não participa de comunidades." : `${firstName} ainda não participa de comunidades.`}
          emptyAction={own ? { href: "/communities", label: "ver comunidades" } : undefined}
        />
      </div>
    </AppShell>
  );
}
