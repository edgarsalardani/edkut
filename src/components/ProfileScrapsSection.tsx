"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Scrap, User } from "@/types";
import { ScrapCard } from "./ScrapCard";
import { UserAvatar } from "./Avatar";
import { EmoticonTextarea } from "./EmoticonTextarea";
import { SCRAP_MAX_LENGTH, canReplyToScraps, deleteScrap, groupScrapThreads, sendScrap, validateScrapBody } from "@/lib/scraps";
import type { FriendshipStatus } from "@/services/socialService";

interface ProfileScrapsSectionProps {
  profileOwner: User;
  currentUser: User;
  initialScraps: Scrap[];
  /** Perfis REAIS dos autores dos scraps carregados. */
  authors: User[];
  isOwnProfile: boolean;
  /** Relação com o dono do perfil (decide se o formulário aparece). Só amigos podem enviar (regra no banco). */
  friendshipStatus: FriendshipStatus;
  /** A leitura no servidor falhou: mostra aviso em vez de "nenhum scrap". */
  loadError?: boolean;
  previewCount?: number;
  /** Avisa o pai quando a lista muda (enviar, responder, apagar), para a tela não perder o estado ao trocar de aba. */
  onScrapsChange?: (scraps: Scrap[], authors: User[]) => void;
}

function hintForNonFriend(status: FriendshipStatus, firstName: string): string {
  if (status === "request_sent") return `Sua solicitação de amizade para ${firstName} está aguardando resposta. Quando for aceita, você poderá deixar recados.`;
  if (status === "request_received") return `${firstName} enviou uma solicitação de amizade para você. Aceite para poder trocar recados.`;
  return `Somente amigos podem deixar recados. Adicione ${firstName} como amigo para escrever aqui.`;
}

export function ProfileScrapsSection({
  profileOwner,
  currentUser,
  initialScraps,
  authors,
  isOwnProfile,
  friendshipStatus,
  loadError = false,
  previewCount = 50,
  onScrapsChange,
}: ProfileScrapsSectionProps) {
  const [scraps, setScraps] = useState(initialScraps);
  const [authorsById, setAuthorsById] = useState(() => new Map(authors.map((a) => [a.id, a])));
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Resposta: um formulário aberto por vez, sempre ligado a um scrap raiz.
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const firstName = profileOwner.name.split(" ")[0];
  const canSend = !isOwnProfile && friendshipStatus === "friends";
  const canReply = canReplyToScraps(isOwnProfile, friendshipStatus);
  const threads = useMemo(() => groupScrapThreads(scraps), [scraps]);
  const authorOf = (id: string) => (id === currentUser.id ? currentUser : authorsById.get(id));

  useEffect(() => {
    onScrapsChange?.(scraps, Array.from(authorsById.values()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scraps, authorsById]);

  async function handleReply(e: FormEvent, root: Scrap) {
    e.preventDefault();
    if (replySubmitting) return;
    setSuccess(null);
    const invalid = validateScrapBody(replyText);
    if (invalid) {
      setReplyError(invalid);
      return;
    }
    setReplySubmitting(true);
    setReplyError(null);
    const result = await sendScrap(profileOwner.id, replyText, root.id);
    setReplySubmitting(false);
    if (!result.ok || !result.scrap) {
      setReplyError(result.error ?? "Não foi possível enviar a resposta."); // o texto é mantido
      return;
    }
    const sent = result.scrap;
    setAuthorsById((prev) => new Map(prev).set(currentUser.id, currentUser));
    setScraps((prev) => [...prev, sent]);
    setReplyText("");
    setReplyingTo(null);
    setSuccess("Resposta enviada.");
  }

  function toggleReply(rootId: string) {
    setReplyError(null);
    setDeleteError(null);
    setConfirmingId(null);
    if (replyingTo === rootId) {
      setReplyingTo(null);
      return;
    }
    setReplyingTo(rootId);
    setReplyText("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSuccess(null);
    const invalid = validateScrapBody(message);
    if (invalid) {
      setError(invalid);
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await sendScrap(profileOwner.id, message);
    setSubmitting(false);
    if (!result.ok || !result.scrap) {
      // O texto digitado é MANTIDO para o usuário tentar de novo.
      setError(result.error ?? "Não foi possível enviar o recado.");
      return;
    }
    const sent = result.scrap;
    setAuthorsById((prev) => new Map(prev).set(currentUser.id, currentUser));
    setScraps((prev) => [sent, ...prev]);
    setMessage("");
    setSuccess(`Recado enviado para ${firstName}!`);
  }

  async function handleDelete(id: string) {
    if (deletingId) return;
    setDeletingId(id);
    setDeleteError(null);
    setSuccess(null);
    const result = await deleteScrap(id);
    setDeletingId(null);
    if (!result.ok) {
      setDeleteError(result.error ?? "Não foi possível apagar o recado.");
      return;
    }
    // Apagar um scrap raiz apaga as respostas dele (cascata no banco).
    setScraps((prev) => prev.filter((s) => s.id !== id && s.parentId !== id));
    if (replyingTo === id) setReplyingTo(null);
    setConfirmingId(null);
    setSuccess("Recado apagado.");
  }

  return (
    <div className="edkut-card">
      <div className="edkut-card-title flex items-center justify-between">
        <span>scraps de {firstName}</span>
        {isOwnProfile && (
          <Link href="/scraps" className="text-xs font-normal text-edkut-pink hover:underline">
            ver todos
          </Link>
        )}
      </div>

      <div className="px-3.5">
        {canSend ? (
          <form onSubmit={handleSubmit} className="flex gap-2 py-3" noValidate>
            <UserAvatar user={currentUser} size="xs" />
            <div className="min-w-0 flex-1">
              <EmoticonTextarea
                value={message}
                onChange={(next) => {
                  setMessage(next);
                  setError(null);
                }}
                placeholder={`Deixe um recado para ${firstName}...`}
                disabled={submitting}
                ariaLabel={`Recado para ${firstName}`}
                invalid={!!error}
              />
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className={`text-[11px] ${Array.from(message).length > SCRAP_MAX_LENGTH ? "font-bold text-edkut-pinkDark" : "text-edkut-muted"}`}>
                  {Array.from(message).length}/{SCRAP_MAX_LENGTH}
                </span>
                <button type="submit" className="edkut-btn-outline py-1 text-xs" disabled={submitting || !message.trim()}>
                  {submitting ? "enviando..." : "enviar scrap"}
                </button>
              </div>
              {error && (
                <p role="alert" className="mt-1.5 rounded-edkut border border-edkut-pink bg-edkut-pinkSoft px-2.5 py-1.5 text-xs text-edkut-pinkDark">
                  {error} Seu texto foi mantido.
                </p>
              )}
            </div>
          </form>
        ) : (
          <p className="py-3 text-xs text-edkut-muted">
            {isOwnProfile
              ? "Aqui aparecem os recados que seus amigos deixam para você."
              : hintForNonFriend(friendshipStatus, firstName)}
          </p>
        )}

        {success && (
          <p role="status" className="mb-2 rounded-edkut border border-edkut-borderStrong bg-edkut-blueSoft px-2.5 py-1.5 text-xs text-edkut-blue">
            {success}
          </p>
        )}
        {deleteError && (
          <p role="alert" className="mb-2 rounded-edkut border border-edkut-pink bg-edkut-pinkSoft px-2.5 py-1.5 text-xs text-edkut-pinkDark">
            {deleteError}
          </p>
        )}

        <div className="border-t border-edkut-border">
          {loadError ? (
            <p role="alert" className="py-3 text-sm text-edkut-pinkDark">
              Não foi possível carregar os recados agora. Atualize a página para tentar de novo.
            </p>
          ) : threads.length === 0 ? (
            <p className="py-3 text-sm text-edkut-muted">
              {isOwnProfile ? "Você ainda não recebeu nenhum recado." : `${firstName} ainda não recebeu nenhum recado.`}
            </p>
          ) : (
            threads.slice(0, previewCount).map(({ root, replies }) => {
              const rootAuthor = authorOf(root.authorId);
              return (
                <div key={root.id} className="border-b border-edkut-border last:border-b-0">
                  <ScrapCard
                    scrap={root}
                    author={rootAuthor}
                    canDelete={isOwnProfile || root.authorId === currentUser.id}
                    confirmingDelete={confirmingId === root.id}
                    deleting={deletingId === root.id}
                    deletePrompt={
                      replies.length > 0
                        ? `Apagar este recado e ${replies.length === 1 ? "a resposta" : `as ${replies.length} respostas`}?`
                        : "Apagar este recado?"
                    }
                    onReply={canReply ? () => toggleReply(root.id) : undefined}
                    replyOpen={replyingTo === root.id}
                    onAskDelete={() => {
                      setConfirmingId(root.id);
                      setDeleteError(null);
                    }}
                    onCancelDelete={() => setConfirmingId(null)}
                    onConfirmDelete={() => handleDelete(root.id)}
                  />

                  {(replies.length > 0 || replyingTo === root.id) && (
                    <div className="mb-2 ml-5 border-l-2 border-edkut-border pl-3" aria-label="Respostas a este recado">
                      {replies.map((reply) => (
                        <ScrapCard
                          key={reply.id}
                          scrap={reply}
                          author={authorOf(reply.authorId)}
                          isReply
                          canDelete={isOwnProfile || reply.authorId === currentUser.id}
                          confirmingDelete={confirmingId === reply.id}
                          deleting={deletingId === reply.id}
                          deletePrompt="Apagar esta resposta?"
                          onAskDelete={() => {
                            setConfirmingId(reply.id);
                            setDeleteError(null);
                          }}
                          onCancelDelete={() => setConfirmingId(null)}
                          onConfirmDelete={() => handleDelete(reply.id)}
                        />
                      ))}

                      {replyingTo === root.id && (
                        <form onSubmit={(e) => handleReply(e, root)} className="flex gap-2 py-2" noValidate>
                          <UserAvatar user={currentUser} size="xs" />
                          <div className="min-w-0 flex-1">
                            <EmoticonTextarea
                              value={replyText}
                              onChange={(next) => {
                                setReplyText(next);
                                setReplyError(null);
                              }}
                              placeholder={`Responder a ${rootAuthor ? rootAuthor.name.split(" ")[0] : "este recado"}...`}
                              disabled={replySubmitting}
                              ariaLabel={`Resposta ao recado de ${rootAuthor ? rootAuthor.name : "usuário"}`}
                              invalid={!!replyError}
                              autoFocus
                            />
                            <div className="mt-1.5 flex items-center justify-between gap-2">
                              <span className={`text-[11px] ${Array.from(replyText).length > SCRAP_MAX_LENGTH ? "font-bold text-edkut-pinkDark" : "text-edkut-muted"}`}>
                                {Array.from(replyText).length}/{SCRAP_MAX_LENGTH}
                              </span>
                              <span className="flex items-center gap-2">
                                <button type="button" className="edkut-link text-xs" onClick={() => toggleReply(root.id)} disabled={replySubmitting}>
                                  cancelar
                                </button>
                                <button type="submit" className="edkut-btn-outline py-1 text-xs" disabled={replySubmitting || !replyText.trim()}>
                                  {replySubmitting ? "enviando..." : "enviar resposta"}
                                </button>
                              </span>
                            </div>
                            {replyError && (
                              <p role="alert" className="mt-1.5 rounded-edkut border border-edkut-pink bg-edkut-pinkSoft px-2.5 py-1.5 text-xs text-edkut-pinkDark">
                                {replyError} Seu texto foi mantido.
                              </p>
                            )}
                          </div>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
