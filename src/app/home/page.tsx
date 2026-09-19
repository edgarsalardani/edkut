import { AppShell } from "@/components/AppShell";
import { ProfileCard } from "@/components/ProfileCard";
import { FriendGrid } from "@/components/FriendGrid";
import { CommunityGrid } from "@/components/CommunityGrid";
import { PostFeed } from "@/components/PostFeed";
import { getCurrentUser, getFriendsOf } from "@/services/userService";
import { getFeedPosts } from "@/services/postService";
import { getMyCommunities, getCommunitiesToDiscover } from "@/services/communityService";

export default async function HomePage() {
  const currentUser = await getCurrentUser();
  const [posts, friends, myCommunities, discoverCommunities] = await Promise.all([
    getFeedPosts(),
    getFriendsOf(currentUser.id),
    getMyCommunities(currentUser.id),
    getCommunitiesToDiscover(currentUser.id, 4),
  ]);

  return (
    <AppShell>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[210px_1fr_250px]">
        <aside className="flex flex-col gap-3 lg:order-1">
          <ProfileCard user={currentUser} />
        </aside>

        <section className="flex flex-col gap-3 lg:order-2">
          <div className="rounded-edkut border border-edkut-border bg-white px-3.5 py-2.5">
            <h1 className="font-heading text-base font-bold text-edkut-blue">
              Olá, {currentUser.name.split(" ")[0]}!{" "}
              <span className="font-normal text-edkut-muted">
                veja o que a galera do edkut está estudando e discutindo hoje.
              </span>
            </h1>
          </div>

          <PostFeed initialPosts={posts} currentUser={currentUser} />
        </section>

        <aside className="flex flex-col gap-3 lg:order-3">
          <FriendGrid friends={friends.slice(0, 6)} title="amigos" viewAllHref="/friends" columns={3} />
          <CommunityGrid
            communities={myCommunities.slice(0, 5)}
            title="minhas comunidades"
            viewAllHref="/communities"
            variant="list"
            emptyMessage="Você ainda não entrou em nenhuma comunidade."
          />
          <CommunityGrid
            communities={discoverCommunities}
            title="sugestões de comunidades"
            viewAllHref="/communities"
            variant="list"
          />
        </aside>
      </div>
    </AppShell>
  );
}
