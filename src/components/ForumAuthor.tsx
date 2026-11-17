import Link from "next/link";
import { Avatar } from "./Avatar";
import type { ForumAuthor as Author } from "@/types";

/** Foto + nome do autor (link para o perfil). Conta excluída ou desconhecida: "usuário indisponível". */
export function ForumAuthorBadge({ author, size = "xs", nameClass = "font-bold" }: { author: Author | undefined; size?: "xs" | "sm"; nameClass?: string }) {
  if (!author) {
    return (
      <span className="inline-flex items-center gap-1.5 text-edkut-muted">
        <span className={`${size === "sm" ? "h-9 w-9" : "h-6 w-6"} shrink-0 rounded-edkut border border-edkut-border bg-edkut-blueSoft`} aria-hidden />
        <span className="text-xs">usuário indisponível</span>
      </span>
    );
  }
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Link href={`/profile/${author.id}`} aria-label={`Ver perfil de ${author.name}`} className="shrink-0">
        <Avatar emoji={author.avatarEmoji} color={author.avatarColor} imageUrl={author.avatarUrl} size={size} />
      </Link>
      <Link href={`/profile/${author.id}`} className={`edkut-link min-w-0 [overflow-wrap:anywhere] text-xs ${nameClass}`}>
        {author.name}
      </Link>
    </span>
  );
}

/** Data e hora curtas ("17/11/2026, 10:39"). */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
