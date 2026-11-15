"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import { Testimonial, User } from "@/types";
import { TestimonialCard } from "./TestimonialCard";
import { UserAvatar } from "./Avatar";
import { EmoticonTextarea } from "./EmoticonTextarea";
import {
  TESTIMONIAL_MAX_LENGTH,
  deleteTestimonial,
  reviewTestimonial,
  sendTestimonial,
  validateTestimonialBody,
} from "@/lib/testimonials";

interface ProfileTestimonialsSectionProps {
  profileOwner: User;
  currentUser: User;
  initialTestimonials: Testimonial[];
  /** Perfis REAIS dos autores dos depoimentos carregados. */
  authors: User[];
  isOwnProfile: boolean;
  /** A leitura no servidor falhou: mostra aviso em vez de "nenhum depoimento". */
  loadError?: boolean;
  /** Avisa o pai quantos depoimentos aguardam aprovação (só faz sentido para o dono do perfil). */
  onPendingChange?: (count: number) => void;
  /** Avisa o pai quando a lista muda (enviar, aprovar, recusar, apagar), para o perfil e a aba ficarem em sincronia. */
  onItemsChange?: (items: Testimonial[], authors: User[]) => void;
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="border-t border-edkut-border first:border-t-0">
      <h3 className="pt-3 font-heading text-xs font-bold uppercase tracking-wide text-edkut-muted">{title}</h3>
      {hint && <p className="text-[11px] text-edkut-muted">{hint}</p>}
      {children}
    </div>
  );
}

/**
 * Depoimentos reais. Regras (no banco): nasce `pending`; só o destinatário aprova/recusa; só `approved` é público;
 * o autor acompanha o status do que enviou. O destinatário vê pendentes e recusados; visitantes só os aprovados
 * (mais os próprios depoimentos, em qualquer status).
 */
export function ProfileTestimonialsSection({
  profileOwner,
  currentUser,
  initialTestimonials,
  authors,
  isOwnProfile,
  loadError = false,
  onPendingChange,
  onItemsChange,
}: ProfileTestimonialsSectionProps) {
  const [items, setItems] = useState(initialTestimonials);
  const [authorsById, setAuthorsById] = useState(() => new Map(authors.map((a) => [a.id, a])));
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const firstName = profileOwner.name.split(" ")[0];
  const mine = (t: Testimonial) => t.authorId === currentUser.id;
  const authorOf = (t: Testimonial) => (mine(t) ? currentUser : authorsById.get(t.authorId));

  const pending = items.filter((t) => t.status === "pending");
  const approved = items.filter((t) => t.status === "approved");
  const rejected = items.filter((t) => t.status === "rejected");
  const myNotPublic = items.filter((t) => mine(t) && t.status !== "approved");
  const hasMyPending = items.some((t) => mine(t) && t.status === "pending");
  const canWrite = !isOwnProfile && !hasMyPending;

  useEffect(() => {
    if (isOwnProfile) onPendingChange?.(pending.length);
  }, [isOwnProfile, pending.length, onPendingChange]);

  useEffect(() => {
    onItemsChange?.(items, Array.from(authorsById.values()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, authorsById]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setNotice(null);
    const invalid = validateTestimonialBody(message);
    if (invalid) {
      setError(invalid);
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await sendTestimonial(profileOwner.id, message);
    setSubmitting(false);
    if (!result.ok || !result.testimonial) {
      setError(result.error ?? "Não foi possível enviar o depoimento."); // o texto é mantido
      return;
    }
    const sent = result.testimonial;
    setAuthorsById((prev) => new Map(prev).set(currentUser.id, currentUser));
    setItems((prev) => [sent, ...prev]);
    setMessage("");
    setNotice(`Depoimento enviado! Ele aparecerá no perfil de ${firstName} depois que ${firstName} aprovar.`);
  }

  async function handleReview(t: Testimonial, status: "approved" | "rejected") {
    if (busyId) return;
    setBusyId(t.id);
    setActionError(null);
    setNotice(null);
    const result = await reviewTestimonial(t.id, status);
    setBusyId(null);
    if (!result.ok || !result.testimonial) {
      setActionError(result.error ?? "Não foi possível atualizar o depoimento.");
      return;
    }
    const updated = result.testimonial;
    setItems((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
    setNotice(status === "approved" ? "Depoimento aprovado: agora ele aparece no seu perfil." : "Depoimento recusado: ele não aparece no seu perfil.");
  }

  async function handleDelete(t: Testimonial) {
    if (busyId) return;
    setBusyId(t.id);
    setActionError(null);
    setNotice(null);
    const result = await deleteTestimonial(t.id);
    setBusyId(null);
    if (!result.ok) {
      setActionError(result.error ?? "Não foi possível apagar o depoimento.");
      return;
    }
    setItems((prev) => prev.filter((x) => x.id !== t.id));
    setConfirmingId(null);
    setNotice("Depoimento apagado.");
  }

  function deleteControls(t: Testimonial) {
    if (confirmingId !== t.id) {
      return (
        <button type="button" className="edkut-link" disabled={busyId !== null} onClick={() => { setConfirmingId(t.id); setActionError(null); }}>
          apagar
        </button>
      );
    }
    return (
      <>
        <span className="text-edkut-muted">Apagar este depoimento?</span>
        <button type="button" className="font-bold text-edkut-pinkDark hover:underline" disabled={busyId !== null} onClick={() => handleDelete(t)}>
          {busyId === t.id ? "apagando..." : "sim, apagar"}
        </button>
        <button type="button" className="edkut-link" disabled={busyId !== null} onClick={() => setConfirmingId(null)}>
          cancelar
        </button>
      </>
    );
  }

  /** Botões do DESTINATÁRIO: aprovar / recusar / apagar. */
  function ownerActions(t: Testimonial) {
    return (
      <>
        {t.status !== "approved" && (
          <button type="button" className="edkut-btn py-0.5 text-xs" disabled={busyId !== null} onClick={() => handleReview(t, "approved")}>
            {busyId === t.id ? "salvando..." : "aprovar"}
          </button>
        )}
        {t.status !== "rejected" && (
          <button type="button" className="edkut-btn-outline py-0.5 text-xs" disabled={busyId !== null} onClick={() => handleReview(t, "rejected")}>
            {t.status === "approved" ? "tirar do perfil" : "recusar"}
          </button>
        )}
        {deleteControls(t)}
      </>
    );
  }

  const emptyOwner = items.length === 0;

  return (
    <div className="edkut-card">
      <div className="edkut-card-title flex items-center justify-between">
        <span>depoimentos{isOwnProfile && pending.length > 0 ? ` (${pending.length} para aprovar)` : ""}</span>
        {isOwnProfile && (
          <Link href="/testimonials" className="text-xs font-normal text-edkut-pink hover:underline">
            ver todos
          </Link>
        )}
      </div>

      <div className="px-3.5">
        {!isOwnProfile && (
          canWrite ? (
            <form onSubmit={handleSubmit} className="flex gap-2 py-3" noValidate>
              <UserAvatar user={currentUser} size="xs" />
              <div className="min-w-0 flex-1">
                <EmoticonTextarea
                  value={message}
                  onChange={(next) => {
                    setMessage(next);
                    setError(null);
                  }}
                  placeholder={`Escreva um depoimento sobre ${firstName}...`}
                  disabled={submitting}
                  ariaLabel={`Depoimento sobre ${firstName}`}
                  invalid={!!error}
                />
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className={`text-[11px] ${Array.from(message).length > TESTIMONIAL_MAX_LENGTH ? "font-bold text-edkut-pinkDark" : "text-edkut-muted"}`}>
                    {Array.from(message).length}/{TESTIMONIAL_MAX_LENGTH} · só aparece depois de aprovado por {firstName}
                  </span>
                  <button type="submit" className="edkut-btn-outline py-1 text-xs" disabled={submitting || !message.trim()}>
                    {submitting ? "enviando..." : "enviar depoimento"}
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
              Você já enviou um depoimento para {firstName} e ele aguarda aprovação. Depois da resposta você poderá enviar outro.
            </p>
          )
        )}

        {notice && (
          <p role="status" className="mb-2 rounded-edkut border border-edkut-borderStrong bg-edkut-blueSoft px-2.5 py-1.5 text-xs text-edkut-blue">
            {notice}
          </p>
        )}
        {actionError && (
          <p role="alert" className="mb-2 rounded-edkut border border-edkut-pink bg-edkut-pinkSoft px-2.5 py-1.5 text-xs text-edkut-pinkDark">
            {actionError}
          </p>
        )}

        <div className="border-t border-edkut-border">
          {loadError ? (
            <p role="alert" className="py-3 text-sm text-edkut-pinkDark">
              Não foi possível carregar os depoimentos agora. Atualize a página para tentar de novo.
            </p>
          ) : isOwnProfile ? (
            emptyOwner ? (
              <p className="py-3 text-sm text-edkut-muted">Você ainda não recebeu nenhum depoimento.</p>
            ) : (
              <>
                {pending.length > 0 && (
                  <Group title={`aguardando sua aprovação (${pending.length})`} hint="Só você vê estes. Eles só aparecem no seu perfil se você aprovar.">
                    {pending.map((t) => (
                      <TestimonialCard key={t.id} testimonial={t} author={authorOf(t)} actions={ownerActions(t)} />
                    ))}
                  </Group>
                )}
                <Group title={`publicados no seu perfil (${approved.length})`}>
                  {approved.length === 0 ? (
                    <p className="py-2 text-sm text-edkut-muted">Nenhum depoimento aprovado ainda.</p>
                  ) : (
                    approved.map((t) => <TestimonialCard key={t.id} testimonial={t} author={authorOf(t)} actions={ownerActions(t)} />)
                  )}
                </Group>
                {rejected.length > 0 && (
                  <Group title={`recusados (${rejected.length})`} hint="Não aparecem no seu perfil. Você pode aprovar depois, se mudar de ideia.">
                    {rejected.map((t) => (
                      <TestimonialCard key={t.id} testimonial={t} author={authorOf(t)} actions={ownerActions(t)} />
                    ))}
                  </Group>
                )}
              </>
            )
          ) : (
            <>
              {myNotPublic.length > 0 && (
                <Group title="seu depoimento" hint="Só você e o destinatário veem o andamento.">
                  {myNotPublic.map((t) => (
                    <TestimonialCard key={t.id} testimonial={t} author={currentUser} showStatus actions={deleteControls(t)} />
                  ))}
                </Group>
              )}
              {approved.length === 0 ? (
                myNotPublic.length === 0 && <p className="py-3 text-sm text-edkut-muted">{firstName} ainda não tem depoimentos publicados.</p>
              ) : (
                <Group title="publicados">
                  {approved.map((t) => (
                    <TestimonialCard key={t.id} testimonial={t} author={authorOf(t)} actions={mine(t) ? deleteControls(t) : undefined} />
                  ))}
                </Group>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
