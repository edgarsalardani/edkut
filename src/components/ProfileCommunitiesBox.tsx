import Link from "next/link";
import { Avatar } from "./Avatar";
import type { ProfileCommunity } from "@/types";

interface ProfileCommunitiesBoxProps {
  communities: ProfileCommunity[];
  total: number | null;
  viewAllHref: string;
  emptyMessage: string;
  emptyAction?: { href: string; label: string };
  columns?: 3 | 4;
}

/** Quadro "comunidades" (coluna direita): imagens (ou emoji), nomes clicáveis, total real e "ver todas". */
export function ProfileCommunitiesBox({ communities, total, viewAllHref, emptyMessage, emptyAction, columns = 3 }: ProfileCommunitiesBoxProps) {
  return (
    <div className="rounded-edkut border border-edkut-border bg-white p-3" data-testid="communities-box">
      <div className="mb-2 flex items-center justify-between border-b border-edkut-border pb-1.5">
        <h3 className="font-heading text-sm font-bold text-edkut-blue">comunidades ({total ?? "–"})</h3>
        <Link href={viewAllHref} className="edkut-link text-xs font-semibold">ver todas</Link>
      </div>
      {communities.length === 0 ? (
        <p className="text-sm text-edkut-muted">
          {emptyMessage}
          {emptyAction && <> <Link href={emptyAction.href} className="edkut-link font-semibold">{emptyAction.label}</Link></>}
        </p>
      ) : (
        <ul className={`grid ${columns === 4 ? "grid-cols-4" : "grid-cols-3"} gap-2`}>
          {communities.map((c) => (
            <li key={c.id} className="min-w-0">
              <Link href={`/communities/${c.id}`} className="flex flex-col items-center gap-1 rounded-edkut p-1.5 text-center hover:bg-edkut-blueSoft">
                <Avatar emoji={c.emoji} color={c.color} imageUrl={c.imageUrl} size="sm" />
                <span title={c.name} className="line-clamp-2 w-full break-words text-[10.5px] font-semibold leading-tight text-edkut-blue">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
