import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { FriendGrid } from "@/components/FriendGrid";
import { getCurrentUser, getProfileUserById } from "@/services/authService";
import { getFriendsOf } from "@/services/socialService";

/** /profile/[id]/friends — todos os amigos de um perfil (dados reais; a RLS/RPC do banco decide o que existe). */
export default async function ProfileFriendsPage({ params }: { params: { id: string } }) {
  const currentUser = await getCurrentUser();
  const profileUser = await getProfileUserById(params.id);
  if (!profileUser) notFound();
  const friends = await getFriendsOf(profileUser.id);
  const own = profileUser.id === currentUser.id;
  const firstName = profileUser.name.split(" ")[0];

  return (
    <AppShell>
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        <p className="text-xs">
          <Link href={`/profile/${profileUser.id}`} className="edkut-link font-semibold">← voltar ao perfil de {profileUser.name}</Link>
        </p>
        <FriendGrid
          friends={friends}
          title={`amigos de ${firstName} (${friends.length})`}
          columns={4}
          emptyMessage={own ? "Você ainda não tem amigos." : `${firstName} ainda não tem amigos.`}
          emptyAction={own ? { href: "/search", label: "buscar pessoas" } : undefined}
        />
      </div>
    </AppShell>
  );
}
