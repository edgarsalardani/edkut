import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ProfilePageClient } from "@/components/ProfilePageClient";
import { getCurrentUser, getProfileUserById } from "@/services/authService";
import { getFriendsOf, getFriendshipState, getMyRating } from "@/services/socialService";
import { isUuid } from "@/lib/uuid";
import { getPostsByAuthor } from "@/services/postService";
import { getCommunitiesByIds } from "@/services/communityService";
import { getScraps } from "@/services/scrapService";
import { getTestimonials } from "@/services/testimonialService";

interface ProfilePageProps {
  params: { id: string };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const currentUser = await getCurrentUser();
  const profileUser = await getProfileUserById(params.id);
  if (!profileUser) notFound();

  const isOwnProfile = profileUser.id === currentUser.id;
  const isRealProfile = isUuid(profileUser.id);

  // Perfis reais: amizade vem da tabela friendships. Perfis fictícios (u1, u2...): continua simulada.
  const friendship = isOwnProfile
    ? ({ status: "self" } as const)
    : isRealProfile
      ? await getFriendshipState(currentUser.id, profileUser.id)
      : ({ status: currentUser.friendIds.includes(profileUser.id) ? "friends" : "none" } as const);
  const isAlreadyFriend = friendship.status === "friends";
  // Só carrego minha avaliação quando o painel pode aparecer (amigo real, perfil alheio).
  const myRating = isRealProfile && isAlreadyFriend && !isOwnProfile ? await getMyRating(profileUser.id) : null;

  const [friends, posts, communities, scraps, testimonials] = await Promise.all([
    getFriendsOf(profileUser.id),
    getPostsByAuthor(profileUser.id),
    getCommunitiesByIds(profileUser.communityIds),
    getScraps(profileUser.id),
    getTestimonials(profileUser.id),
  ]);

  return (
    <AppShell>
      <ProfilePageClient
        profileUser={profileUser}
        currentUser={currentUser}
        isOwnProfile={isOwnProfile}
        isAlreadyFriend={isAlreadyFriend}
        friendship={friendship}
        myRating={myRating}
        friends={friends}
        communities={communities}
        posts={posts}
        scraps={scraps}
        testimonials={testimonials}
      />
    </AppShell>
  );
}
