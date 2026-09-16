import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { UserAvatar } from "@/components/Avatar";
import { Tag } from "@/components/Tag";
import { TechProfileIndicators } from "@/components/TechProfileIndicators";
import { FriendGrid } from "@/components/FriendGrid";
import { CommunityGrid } from "@/components/CommunityGrid";
import { PostCard } from "@/components/PostCard";
import { ProfileScrapsSection } from "@/components/ProfileScrapsSection";
import { ProfileTestimonialsSection } from "@/components/ProfileTestimonialsSection";
import { AddFriendButton } from "@/components/AddFriendButton";
import { getCurrentUser, getUserById, getFriendsOf } from "@/services/userService";
import { getPostsByAuthor } from "@/services/postService";
import { getCommunitiesByIds } from "@/services/communityService";
import { getScraps } from "@/services/scrapService";
import { getTestimonials } from "@/services/testimonialService";
import { USER_TYPE_LABEL } from "@/lib/userType";

interface ProfilePageProps {
  params: { id: string };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const currentUser = await getCurrentUser();
  const profileUser = await getUserById(params.id);
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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="flex flex-col gap-4">
          <div className="edkut-card overflow-hidden">
            <div className="flex flex-col items-center gap-2 bg-edkut-blueSoft p-5 text-center">
              <UserAvatar user={profileUser} size="xl" showOnline />
              <h1 className="font-heading text-lg font-bold text-edkut-blue">{profileUser.name}</h1>
              <p className="text-sm font-semibold text-edkut-pink">{USER_TYPE_LABEL[profileUser.userType]}</p>
              <p className="text-xs text-edkut-muted">{profileUser.headline}</p>
            </div>

            <div className="flex flex-col gap-3 p-4">
              <p className="text-sm italic text-edkut-text">&ldquo;{profileUser.bio}&rdquo;</p>

              <dl className="flex flex-col gap-1 text-xs text-edkut-muted">
                {profileUser.institution && (
                  <div className="flex gap-1">
                    <dt className="font-semibold text-edkut-text">instituição:</dt>
                    <dd>{profileUser.institution}</dd>
                  </div>
                )}
                {profileUser.courseOrArea && (
                  <div className="flex gap-1">
                    <dt className="font-semibold text-edkut-text">curso/área:</dt>
                    <dd>{profileUser.courseOrArea}</dd>
                  </div>
                )}
                {profileUser.location && (
                  <div className="flex gap-1">
                    <dt className="font-semibold text-edkut-text">local:</dt>
                    <dd>{profileUser.location}</dd>
                  </div>
                )}
              </dl>

              <div className="flex flex-wrap gap-1.5">
                {profileUser.interests.map((interest) => (
                  <Tag key={interest} label={interest} />
                ))}
              </div>

              <div className="flex justify-between text-center text-xs text-edkut-muted">
                <div>
                  <p className="font-heading text-base font-bold text-edkut-blue">{profileUser.friendIds.length}</p>
                  amigos
                </div>
                <div>
                  <p className="font-heading text-base font-bold text-edkut-blue">{profileUser.communityIds.length}</p>
                  comunidades
                </div>
              </div>

              <TechProfileIndicators scores={profileUser.techProfile} />

              {!isOwnProfile && !isAlreadyFriend && <AddFriendButton />}
              {!isOwnProfile && isAlreadyFriend && (
                <p className="text-center text-xs font-semibold text-edkut-green">vocês já são amigos</p>
              )}
            </div>
          </div>

          <FriendGrid
            friends={friends.slice(0, 9)}
            title="amigos"
            viewAllHref={isOwnProfile ? "/friends" : undefined}
            columns={3}
          />

          <CommunityGrid
            communities={communities}
            title="comunidades"
            viewAllHref="/communities"
            variant="list"
            emptyMessage="Ainda não entrou em nenhuma comunidade."
          />
        </aside>

        <section className="flex flex-col gap-4">
          <div className="edkut-card p-4">
            <h2 className="font-heading text-sm font-bold text-edkut-blue">publicações de {profileUser.name.split(" ")[0]}</h2>
          </div>

          {posts.length === 0 ? (
            <div className="edkut-card p-6 text-center text-sm text-edkut-muted">
              {profileUser.name.split(" ")[0]} ainda não publicou nada por aqui.
            </div>
          ) : (
            posts.map((post) => <PostCard key={post.id} post={post} currentUser={currentUser} />)
          )}

          <ProfileScrapsSection
            profileOwner={profileUser}
            currentUser={currentUser}
            initialScraps={scraps}
            isOwnProfile={isOwnProfile}
          />

          <ProfileTestimonialsSection
            profileOwner={profileUser}
            currentUser={currentUser}
            initialTestimonials={testimonials}
            isOwnProfile={isOwnProfile}
          />
        </section>
      </div>
    </AppShell>
  );
}
