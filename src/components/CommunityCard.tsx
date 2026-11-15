import Link from "next/link";
import { CommunityInfo } from "@/types";
import { Avatar } from "./Avatar";
import { JOIN_POLICY_LABEL, type MyStatus } from "@/lib/communities";

const STATUS_BADGE: Record<MyStatus, string | null> = {
  creator: "você criou",
  moderator: "você modera",
  member: "você participa",
  pending: "solicitação enviada",
  none: null,
};

/** Cartão de uma comunidade REAL na lista: imagem (ou emoji), nome, descrição, categoria, membros e tipo de entrada. */
export function CommunityCard({ community, status }: { community: CommunityInfo; status: MyStatus }) {
  const badge = STATUS_BADGE[status];
  return (
    <Link
      href={`/communities/${community.id}`}
      className="flex gap-3 rounded-edkut border border-edkut-border bg-white p-3 hover:border-edkut-pink"
    >
      <Avatar emoji={community.emoji} color={community.color} imageUrl={community.imageUrl} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-heading text-sm font-bold text-edkut-blue">{community.name}</p>
        <p className="line-clamp-2 text-xs text-edkut-muted">{community.description}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <span className="font-semibold text-edkut-pink">
            {community.memberCount.toLocaleString("pt-BR")} {community.memberCount === 1 ? "membro" : "membros"}
          </span>
          <span className="text-edkut-faint">{community.category}</span>
          <span className="text-edkut-faint">· {JOIN_POLICY_LABEL[community.joinPolicy]}</span>
        </p>
        {badge && <span className="edkut-tag mt-1">{badge}</span>}
      </div>
    </Link>
  );
}
