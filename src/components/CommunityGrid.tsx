import Link from "next/link";
import { Community } from "@/types";
import { CommunityAvatar } from "./Avatar";

interface CommunityGridProps {
  communities: Community[];
  title?: string;
  viewAllHref?: string;
  emptyMessage?: string;
  variant?: "cards" | "list";
}

export function CommunityGrid({
  communities,
  title,
  viewAllHref,
  emptyMessage = "Nenhuma comunidade encontrada.",
  variant = "cards",
}: CommunityGridProps) {
  const content =
    communities.length === 0 ? (
      <div className="rounded-edkut border border-dashed border-edkut-border p-6 text-center text-sm text-edkut-muted">
        {emptyMessage}
      </div>
    ) : variant === "list" ? (
      <ul className="flex flex-col divide-y divide-edkut-border">
        {communities.map((c) => (
          <li key={c.id}>
            <Link
              href={`/communities/${c.id}`}
              className="flex items-center gap-2 py-2 hover:bg-edkut-blueSoft"
            >
              <CommunityAvatar community={c} size="xs" />
              <span className="flex-1 truncate text-sm font-semibold text-edkut-blue">{c.name}</span>
              <span className="whitespace-nowrap text-xs text-edkut-muted">
                {c.memberCount.toLocaleString("pt-BR")} membros
              </span>
            </Link>
          </li>
        ))}
      </ul>
    ) : (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {communities.map((c) => (
          <Link
            key={c.id}
            href={`/communities/${c.id}`}
            className="flex gap-3 rounded-edkut border border-edkut-border bg-white p-3 hover:border-edkut-pink"
          >
            <CommunityAvatar community={c} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-heading text-sm font-bold text-edkut-blue">{c.name}</p>
              <p className="line-clamp-2 text-xs text-edkut-muted">{c.description}</p>
              <p className="mt-1 text-xs font-semibold text-edkut-pink">
                {c.memberCount.toLocaleString("pt-BR")} membros
              </p>
            </div>
          </Link>
        ))}
      </div>
    );

  if (!title) return content;

  return (
    <div className="rounded-edkut border border-edkut-border bg-white p-3">
      <div className="mb-2 flex items-center justify-between border-b border-edkut-border pb-1.5">
        <h3 className="font-heading text-sm font-bold text-edkut-blue">{title}</h3>
        {viewAllHref && (
          <Link href={viewAllHref} className="edkut-link text-xs font-semibold">
            ver todas
          </Link>
        )}
      </div>
      {content}
    </div>
  );
}
