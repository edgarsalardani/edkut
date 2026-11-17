import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { CommunityPageClient } from "@/components/CommunityPageClient";
import { getCurrentUser } from "@/services/authService";
import { getCommunityPageData } from "@/services/communityService";
import { isUuid } from "@/lib/uuid";
import { parseCommunityTab, parseTopicId } from "@/lib/forum";

interface CommunityPageProps {
  params: { id: string };
  searchParams?: { imagem?: string; aba?: string | string[]; topico?: string | string[] };
}

export default async function CommunityPage({ params, searchParams }: CommunityPageProps) {
  if (!isUuid(params.id)) notFound();
  const currentUser = await getCurrentUser();
  const data = await getCommunityPageData(params.id, currentUser.id);

  if (data.error) {
    return (
      <AppShell>
        <p role="alert" className="edkut-card p-4 text-sm text-edkut-pinkDark">
          Não foi possível carregar esta comunidade agora. Atualize a página para tentar de novo.
        </p>
      </AppShell>
    );
  }
  if (!data.community) notFound();

  return (
    <AppShell>
      <CommunityPageClient
        initialCommunity={data.community}
        categories={data.categories}
        initialMembers={data.members}
        initialPeople={data.people}
        initialRole={data.myRole}
        initialPending={data.myPending}
        initialRequests={data.pendingRequests}
        membersTruncated={data.membersTruncated}
        currentUser={currentUser}
        imageWarning={searchParams?.imagem === "falhou"}
        initialTab={parseCommunityTab(typeof searchParams?.aba === "string" ? searchParams.aba : undefined)}
        initialTopicId={parseTopicId(typeof searchParams?.topico === "string" ? searchParams.topico : undefined)}
      />
    </AppShell>
  );
}
