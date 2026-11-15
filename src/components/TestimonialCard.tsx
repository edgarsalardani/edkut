import Link from "next/link";
import { ReactNode } from "react";
import { Testimonial, User } from "@/types";
import { UserAvatar } from "./Avatar";
import { formatRelativeTime } from "@/lib/format";

const STATUS_BADGE: Record<NonNullable<Testimonial["status"]>, { label: string; className: string } | null> = {
  pending: { label: "aguardando aprovação", className: "border-edkut-borderStrong bg-edkut-blueSoft text-edkut-blue" },
  rejected: { label: "recusado", className: "border-edkut-pink bg-edkut-pinkSoft text-edkut-pinkDark" },
  approved: null,
};

/**
 * Um depoimento com o autor REAL (nome, avatar e link). `showStatus` exibe a etiqueta de status
 * (usada para o autor acompanhar o que enviou e para o destinatário ver o que ainda não é público).
 * `actions` recebe os botões (aprovar/recusar/apagar), controlados por quem renderiza.
 */
export function TestimonialCard({
  testimonial,
  author,
  showStatus = false,
  actions,
}: {
  testimonial: Testimonial;
  author?: User;
  showStatus?: boolean;
  actions?: ReactNode;
}) {
  const badge = showStatus && testimonial.status ? STATUS_BADGE[testimonial.status] : null;

  return (
    <div className="flex gap-2.5 border-b border-edkut-border py-3 last:border-b-0">
      {author ? (
        <Link href={`/profile/${author.id}`} aria-label={`Ver perfil de ${author.name}`}>
          <UserAvatar user={author} size="sm" />
        </Link>
      ) : (
        <div className="h-10 w-10 shrink-0 rounded-edkut border border-edkut-border bg-edkut-blueSoft" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          {author ? (
            <Link href={`/profile/${author.id}`} className="font-heading text-sm font-bold text-edkut-blue hover:underline">
              {author.name}
            </Link>
          ) : (
            <span className="font-heading text-sm font-bold text-edkut-muted">usuário indisponível</span>
          )}
          <span className="text-xs text-edkut-faint">{formatRelativeTime(testimonial.createdAt)}</span>
          {badge && <span className={`rounded-edkut border px-1.5 text-[11px] font-semibold ${badge.className}`}>{badge.label}</span>}
        </div>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm italic text-edkut-text">&ldquo;{testimonial.message}&rdquo;</p>
        {actions && <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">{actions}</div>}
      </div>
    </div>
  );
}
