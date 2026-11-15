import Link from "next/link";
import { Scrap, User } from "@/types";
import { UserAvatar } from "./Avatar";
import { EmoticonText } from "./Emoticon";
import { formatRelativeTime } from "@/lib/format";

interface ScrapCardProps {
  scrap: Scrap;
  /** Autor REAL (perfil do Supabase). Se não puder ser carregado, mostra um rótulo neutro. */
  author?: User;
  /** Resposta dentro de uma conversa (avatar menor; o recuo é feito por quem renderiza). */
  isReply?: boolean;
  /** Dono do perfil ou autor do scrap: mostra "apagar". */
  canDelete?: boolean;
  /** Etapa da exclusão em duas fases: false = botão "apagar"; true = "confirmar / cancelar". */
  confirmingDelete?: boolean;
  deleting?: boolean;
  /** Texto da confirmação (padrão: "Apagar este recado?"). */
  deletePrompt?: string;
  /** Mostra o botão "responder" (só para quem pode responder). */
  onReply?: () => void;
  replyOpen?: boolean;
  onAskDelete?: () => void;
  onCancelDelete?: () => void;
  onConfirmDelete?: () => void;
}

export function ScrapCard({
  scrap,
  author,
  isReply = false,
  canDelete = false,
  confirmingDelete = false,
  deleting = false,
  deletePrompt = "Apagar este recado?",
  onReply,
  replyOpen = false,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: ScrapCardProps) {
  return (
    <div className={`flex gap-2.5 ${isReply ? "py-2" : "py-3"}`}>
      {author ? (
        <Link href={`/profile/${author.id}`} aria-label={`Ver perfil de ${author.name}`}>
          <UserAvatar user={author} size={isReply ? "xs" : "sm"} />
        </Link>
      ) : (
        <div
          className={`${isReply ? "h-8 w-8" : "h-10 w-10"} shrink-0 rounded-edkut border border-edkut-border bg-edkut-blueSoft`}
          aria-hidden
        />
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
          <span className="text-xs text-edkut-faint">{formatRelativeTime(scrap.createdAt)}</span>
        </div>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-edkut-text">
          <EmoticonText text={scrap.message} />
        </p>

        {(onReply || canDelete) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {onReply && !confirmingDelete && (
              <button type="button" onClick={onReply} className="edkut-link" aria-expanded={replyOpen}>
                {replyOpen ? "fechar resposta" : "responder"}
              </button>
            )}
            {canDelete &&
              (!confirmingDelete ? (
                <button type="button" onClick={onAskDelete} className="edkut-link" disabled={deleting}>
                  apagar
                </button>
              ) : (
                <>
                  <span className="text-edkut-muted">{deletePrompt}</span>
                  <button type="button" onClick={onConfirmDelete} disabled={deleting} className="font-bold text-edkut-pinkDark hover:underline">
                    {deleting ? "apagando..." : "sim, apagar"}
                  </button>
                  <button type="button" onClick={onCancelDelete} disabled={deleting} className="edkut-link">
                    cancelar
                  </button>
                </>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
