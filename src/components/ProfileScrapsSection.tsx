"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Scrap, User } from "@/types";
import { ScrapCard } from "./ScrapCard";
import { UserAvatar } from "./Avatar";
import { SCRAP_MAX_LENGTH, deleteScrap, sendScrap, validateScrapBody } from "@/lib/scraps";
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

  const firstName = profileOwner.name.split(" ")[0];
  const canSend = !isOwnProfile && friendshipStatus === "friends";

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
    setScraps((prev) => prev.filter((s) => s.id !== id));
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
              <textarea
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  setError(null);
                }}
                placeholder={`Deixe um recado para ${firstName}...`}
                rows={2}
                className="edkut-input resize-none"
                disabled={submitting}
                aria-label={`Recado para ${firstName}`}
                aria-invalid={error ? true : undefined}
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
          ) : scraps.length === 0 ? (
            <p className="py-3 text-sm text-edkut-muted">
              {isOwnProfile ? "Você ainda não recebeu nenhum recado." : `${firstName} ainda não recebeu nenhum recado.`}
            </p>
          ) : (
            scraps.slice(0, previewCount).map((scrap) => (
              <ScrapCard
                key={scrap.id}
                scrap={scrap}
                author={scrap.authorId === currentUser.id ? currentUser : authorsById.get(scrap.authorId)}
                canDelete={isOwnProfile || scrap.authorId === currentUser.id}
                confirmingDelete={confirmingId === scrap.id}
                deleting={deletingId === scrap.id}
                onAskDelete={() => {
                  setConfirmingId(scrap.id);
                  setDeleteError(null);
                }}
                onCancelDelete={() => setConfirmingId(null)}
                onConfirmDelete={() => handleDelete(scrap.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
