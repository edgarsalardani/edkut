import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { CommunityHeader } from "@/components/CommunityHeader";
import { PostFeed } from "@/components/PostFeed";
import { FriendGrid } from "@/components/FriendGrid";
import { getCurrentUser, getUsersByIds } from "@/services/userService";
import { getCommunityById } from "@/services/communityService";
import { getPostsByCommunity } from "@/services/postService";

interface CommunityPageProps {
  params: { id: string };
}

export default async function CommunityPage({ params }: CommunityPageProps) {
  const currentUser = await getCurrentUser();
  const community = await getCommunityById(params.id);
  if (!community) notFound();

  const [posts, members] = await Promise.all([
    getPostsByCommunity(community.id),
    getUsersByIds(community.memberIds),
  ]);

  const creator = members.find((m) => m.id === community.creatorId) ?? (await getUsersByIds([community.creatorId]))[0];
  const moderators = await getUsersByIds(community.moderatorIds);

  return (
    <AppShell>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]">
        <section className="flex flex-col gap-4 lg:order-1">
          <CommunityHeader community={community} currentUser={currentUser} creator={creator} />
          <PostFeed
            initialPosts={posts}
            currentUser={currentUser}
            communityId={community.id}
            emptyMessage="Ainda não há publicações nesta comunidade. Que tal começar a conversa?"
          />
        </section>

        <aside className="flex flex-col gap-4 lg:order-2">
          <div className="edkut-card p-3.5">
            <h2 className="mb-2 font-heading text-sm font-bold text-edkut-blue">moderadores</h2>
            <div className="flex flex-col gap-1.5">
              {moderators.map((mod) => (
                <p key={mod.id} className="text-sm text-edkut-text">
                  {mod.name}
                </p>
              ))}
            </div>
          </div>

          <FriendGrid friends={members.slice(0, 9)} title="membros" columns={3} emptyMessage="Nenhum membro ainda." />
        </aside>
      </div>
    </AppShell>
  );
}
