import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ProfilePageClient } from "@/components/ProfilePageClient";
import { getCurrentUser, getProfileUserById } from "@/services/authService";
import { getFriendsOf, getFriendshipState, getMyRating } from "@/services/socialService";
import { getScrapsWithAuthors } from "@/services/scrapService";
import { getTestimonialsWithAuthors } from "@/services/testimonialService";
import { isUuid } from "@/lib/uuid";

interface ProfilePageProps {
  params: { id: string };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const currentUser = await getCurrentUser();
  const profileUser = await getProfileUserById(params.id);
  if (!profileUser) notFound();

  const isOwnProfile = profileUser.id === currentUser.id;

  // Amizade real (tabela friendships / friend_requests).
  const friendship = isOwnProfile ? ({ status: "self" } as const) : await getFriendshipState(currentUser.id, profileUser.id);
  const isFriend = friendship.status === "friends";
  // Só carrego minha avaliação quando o painel pode aparecer (amigo, perfil alheio).
  const myRating = isFriend && !isOwnProfile && isUuid(profileUser.id) ? await getMyRating(profileUser.id) : null;

  const [friends, scrapsData, testimonialsData] = await Promise.all([
    getFriendsOf(profileUser.id),
    getScrapsWithAuthors(profileUser.id),
    getTestimonialsWithAuthors(profileUser.id),
  ]);

  return (
    <AppShell>
      <ProfilePageClient
        profileUser={profileUser}
        currentUser={currentUser}
        isOwnProfile={isOwnProfile}
        friendship={friendship}
        myRating={myRating}
        friends={friends}
        scrapsData={scrapsData}
        testimonialsData={testimonialsData}
      />
    </AppShell>
  );
}
