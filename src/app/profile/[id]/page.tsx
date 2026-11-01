import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ProfilePageClient } from "@/components/ProfilePageClient";
import { getCurrentUser, getProfileUserById } from "@/services/authService";
import { getFriendsOf } from "@/services/userService";
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
  const isAlreadyFriend = currentUser.friendIds.includes(profileUser.id);

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
        friends={friends}
        communities={communities}
        posts={posts}
        scraps={scraps}
        testimonials={testimonials}
      />
    </AppShell>
  );
}
