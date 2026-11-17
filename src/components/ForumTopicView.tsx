"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EmoticonText } from "./Emoticon";
import { EmoticonTextarea } from "./EmoticonTextarea";
import { ForumAuthorBadge, formatDateTime } from "./ForumAuthor";
import { formatRelativeTime } from "@/lib/format";
import {
  MESSAGE_MAX,
  canDeleteForumItem,
  deleteMessage,
  deleteTopic,
  groupCommentThreads,
  loadMessages,
  loadTopic,
  mergeById,
  postMessage,
  validateMessage,
} from "@/lib/forum";
import type { ForumAuthor, ForumMessage, ForumTopic } from "@/types";

interface ForumTopicViewProps {
  communityId: string;
  topicId: string;
  currentUserId: string;
  isMember: boolean;
  isModerator: boolean;
  /** Por que não pode publicar (mostrado no lugar do formulário). */
  cannotPostReason: string;
  authors: Map<string, ForumAuthor>;
  ensureAuthors: (ids: (string | null)[]) => Promise<void>;
  onBack: () => void;
  onTopicDeleted: () => void;
}

const len = (v: string) => Array.from(v).length;

function Counter({ value, max }: { value: string; max: number }) {
  const n = len(value);
  return <span className={`text-[11px] ${n > max ? "font-bold text-edkut-pinkDark" : "text-edkut-muted"}`}>{n}/{max}</span>;
}

export function ForumTopicView({ communityId, topicId, currentUserId, isMember, isModerator, cannotPostReason, authors, ensureAuthors, onBack, onTopicDeleted }: ForumTopicViewProps) {
  const [topic, setTopic] = useState<ForumTopic | null | undefined>(undefined); // undefined = carregando; null = não existe
  const [messages, setMessages] = useState<ForumMessage[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null); // "comment" | "reply" | "delete:<id>"
  const [confirming, setConfirming] = useState<string | null>(null); // "topic" | id da mensagem
  const [actionError, setActionError] = useState<string | null>(null);
  const busyRef = useRef(false); // trava síncrona contra duplo clique

  const load = useCallback(async () => {
    setLoadError(null);
    setTopic(undefined);
    const [t, m] = await Promise.all([loadTopic(communityId, topicId), loadMessages(topicId, 0)]);
    if (!t.ok || !m.ok) {
      setLoadError(t.error ?? m.error ?? "Não foi possível carregar o tópico.");
      return;
    }
    setTopic(t.data ?? null);
    setMessages(m.data?.messages ?? []);
    setPage(0);
    setHasMore(m.data?.hasMore ?? false);
    await ensureAuthors([t.data?.authorId ?? null, ...(m.data?.messages ?? []).map((x) => x.authorId)]);
  }, [communityId, topicId, ensureAuthors]);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    const res = await loadMessages(topicId, page + 1);
    setLoadingMore(false);
    if (!res.ok) {
      setActionError(res.error ?? "Não foi possível carregar mais comentários.");
      return;
    }
    setMessages((prev) => mergeById(prev, res.data?.messages ?? []));
    setPage((p) => p + 1);
    setHasMore(res.data?.hasMore ?? false);
    await ensureAuthors((res.data?.messages ?? []).map((x) => x.authorId));
  }

  async function submit(kind: "comment" | "reply") {
    if (busyRef.current || !topic) return;
    const text = kind === "comment" ? comment : replyText;
    const setErr = kind === "comment" ? setCommentError : setReplyError;
    const invalid = validateMessage(text);
    if (invalid) return setErr(invalid);
    busyRef.current = true;
    setSubmitting(kind);
    setErr(null);
    setActionError(null);
    const res = await postMessage(topic.id, text, kind === "reply" ? replyTo ?? undefined : undefined);
    busyRef.current = false;
    setSubmitting(null);
    if (!res.ok || !res.data) return setErr(res.error ?? "Não foi possível enviar.");
    const msg = res.data;
    setMessages((prev) => mergeById(prev, [msg]));
    setTopic((t) => (t ? { ...t, replyCount: t.replyCount + 1, lastActivityAt: msg.createdAt } : t));
    if (kind === "comment") setComment("");
    else {
      setReplyText("");
      setReplyTo(null);
    }
  }

  async function removeTopic() {
    if (busyRef.current || !topic) return;
    busyRef.current = true;
    setSubmitting("delete:topic");
    setActionError(null);
    const res = await deleteTopic(topic.id);
    busyRef.current = false;
    setSubmitting(null);
    if (!res.ok) {
      setConfirming(null);
      return setActionError(res.error ?? "Não foi possível apagar o tópico.");
    }
    onTopicDeleted();
  }

  async function removeMessage(m: ForumMessage) {
    if (busyRef.current) return;
    busyRef.current = true;
    setSubmitting(`delete:${m.id}`);
    setActionError(null);
    const res = await deleteMessage(m.id);
    busyRef.current = false;
    setSubmitting(null);
    setConfirming(null);
    if (!res.ok) return setActionError(res.error ?? "Não foi possível apagar a mensagem.");
    // O banco apaga também as respostas de um comentário apagado.
    setMessages((prev) => prev.filter((x) => x.id !== m.id && x.parentId !== m.id));
    const fresh = await loadTopic(communityId, topicId); // contador e última atividade reais
    if (fresh.ok && fresh.data) setTopic(fresh.data);
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-2">
        <p role="alert" className="rounded-edkut border border-edkut-pink bg-edkut-pinkSoft px-3 py-2 text-sm text-edkut-pinkDark">{loadError}</p>
        <div className="flex gap-3 text-sm">
          <button type="button" className="edkut-btn-outline" onClick={() => void load()}>tentar de novo</button>
          <button type="button" className="edkut-link" onClick={onBack}>← voltar ao fórum</button>
        </div>
      </div>
    );
  }
  if (topic === undefined) return <p className="text-sm text-edkut-muted" role="status">Carregando tópico...</p>;
  if (topic === null) {
    return (
      <div className="edkut-card p-4 text-sm">
        <p className="text-edkut-muted">Este tópico não existe mais (ou foi apagado).</p>
        <button type="button" className="edkut-link mt-2 font-semibold" onClick={onBack}>← voltar ao fórum</button>
      </div>
    );
  }

  const threads = groupCommentThreads(messages);
  const topicAuthor = topic.authorId ? authors.get(topic.authorId) : undefined;
  const canDeleteTopic = canDeleteForumItem(currentUserId, topic.authorId, isModerator);

  const deleteControls = (key: string, label: string, onConfirm: () => void) =>
    confirming === key ? (
      <span className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-edkut-muted">{label}</span>
        <button type="button" className="font-bold text-edkut-pinkDark hover:underline" onClick={onConfirm} disabled={submitting !== null}>
          {submitting === `delete:${key}` ? "apagando..." : "sim, apagar"}
        </button>
        <button type="button" className="edkut-link" onClick={() => setConfirming(null)} disabled={submitting !== null}>cancelar</button>
      </span>
    ) : (
      <button type="button" className="edkut-link text-xs" onClick={() => setConfirming(key)} disabled={submitting !== null} aria-label={key === "topic" ? "Apagar tópico" : "Apagar mensagem"}>
        apagar
      </button>
    );

  return (
    <div className="flex flex-col gap-3" data-testid="forum-topic">
      <button type="button" className="edkut-link self-start text-sm font-semibold" onClick={onBack}>← voltar ao fórum</button>

      {actionError && <p role="alert" className="rounded-edkut border border-edkut-pink bg-edkut-pinkSoft px-3 py-2 text-sm text-edkut-pinkDark">{actionError}</p>}

      <article className="edkut-card" aria-label="Tópico">
        <div className="edkut-card-title [overflow-wrap:anywhere]"><EmoticonText text={topic.title} /></div>
        <div className="flex flex-col gap-2 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <ForumAuthorBadge author={topicAuthor} size="sm" />
              <span className="text-[11px] text-edkut-muted">{formatDateTime(topic.createdAt)}</span>
            </div>
            {canDeleteTopic && deleteControls("topic", "Apagar este tópico e todas as mensagens?", () => void removeTopic())}
          </div>
          <p className="whitespace-pre-wrap [overflow-wrap:anywhere] text-sm text-edkut-text" data-testid="topic-body"><EmoticonText text={topic.body} /></p>
          <p className="border-t border-edkut-border pt-1.5 text-[11px] text-edkut-muted" data-testid="topic-counts">
            {topic.replyCount} {topic.replyCount === 1 ? "mensagem" : "mensagens"} · última atividade {formatRelativeTime(topic.lastActivityAt)}
          </p>
        </div>
      </article>

      <section aria-label="Comentários" className="flex flex-col gap-2">
        {threads.length === 0 && <p className="rounded-edkut border border-dashed border-edkut-border bg-white px-3.5 py-3 text-sm text-edkut-muted">Ainda não há comentários.{isMember ? " Seja o primeiro!" : ""}</p>}
        {threads.map(({ comment: c, replies }) => {
          const author = c.authorId ? authors.get(c.authorId) : undefined;
          return (
            <div key={c.id} className="rounded-edkut border border-edkut-border bg-white" data-testid="forum-comment">
              <div className="flex flex-col gap-1.5 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <ForumAuthorBadge author={author} />
                    <span className="text-[11px] text-edkut-muted">{formatDateTime(c.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {isMember && (
                      <button type="button" className="edkut-link text-xs" onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyText(""); setReplyError(null); }} aria-expanded={replyTo === c.id}>
                        responder
                      </button>
                    )}
                    {canDeleteForumItem(currentUserId, c.authorId, isModerator) && deleteControls(c.id, replies.length > 0 ? "Apagar o comentário e suas respostas?" : "Apagar este comentário?", () => void removeMessage(c))}
                  </div>
                </div>
                <p className="whitespace-pre-wrap [overflow-wrap:anywhere] text-sm text-edkut-text"><EmoticonText text={c.body} /></p>
              </div>

              {(replies.length > 0 || replyTo === c.id) && (
                <div className="ml-4 flex flex-col gap-2 border-l-4 border-edkut-borderStrong bg-edkut-blueSoft p-2.5 sm:ml-8" data-testid="forum-replies">
                  {replies.map((r) => {
                    const ra = r.authorId ? authors.get(r.authorId) : undefined;
                    return (
                      <div key={r.id} className="rounded-edkut bg-white p-2.5" data-testid="forum-reply">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <ForumAuthorBadge author={ra} />
                            <span className="text-[11px] text-edkut-muted">{formatDateTime(r.createdAt)}</span>
                          </div>
                          {canDeleteForumItem(currentUserId, r.authorId, isModerator) && deleteControls(r.id, "Apagar esta resposta?", () => void removeMessage(r))}
                        </div>
                        <p className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere] text-sm text-edkut-text"><EmoticonText text={r.body} /></p>
                      </div>
                    );
                  })}
                  {replyTo === c.id && isMember && (
                    <form
                      aria-label="Responder ao comentário"
                      onSubmit={(e) => { e.preventDefault(); void submit("reply"); }}
                      className="rounded-edkut bg-white p-2.5"
                    >
                      <EmoticonTextarea
                        value={replyText}
                        onChange={(v) => { setReplyText(v); setReplyError(null); }}
                        placeholder={`Responder a ${author ? author.name.split(" ")[0] : "este comentário"}...`}
                        ariaLabel="Resposta ao comentário"
                        disabled={submitting === "reply"}
                        invalid={!!replyError}
                        rows={2}
                        autoFocus
                      />
                      {replyError && <p role="alert" className="mt-1 text-xs text-edkut-pinkDark">{replyError}</p>}
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <Counter value={replyText} max={MESSAGE_MAX} />
                        <span className="flex items-center gap-2">
                          <button type="button" className="edkut-link text-xs" onClick={() => setReplyTo(null)}>cancelar</button>
                          <button type="submit" className="edkut-btn-pink" disabled={submitting === "reply" || len(replyText) > MESSAGE_MAX || !replyText.trim()}>
                            {submitting === "reply" ? "enviando..." : "responder"}
                          </button>
                        </span>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {hasMore && (
          <button type="button" className="edkut-btn-outline self-center" onClick={() => void loadMore()} disabled={loadingMore}>
            {loadingMore ? "carregando..." : "carregar mais comentários"}
          </button>
        )}
      </section>

      {isMember ? (
        <form aria-label="Novo comentário" onSubmit={(e) => { e.preventDefault(); void submit("comment"); }} className="edkut-card p-3.5">
          <h3 className="mb-1.5 font-heading text-sm font-bold text-edkut-blue">comentar</h3>
          <EmoticonTextarea
            value={comment}
            onChange={(v) => { setComment(v); setCommentError(null); }}
            placeholder="Escreva um comentário..."
            ariaLabel="Novo comentário"
            disabled={submitting === "comment"}
            invalid={!!commentError}
            rows={3}
          />
          {commentError && <p role="alert" className="mt-1 text-xs text-edkut-pinkDark">{commentError}</p>}
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <Counter value={comment} max={MESSAGE_MAX} />
            <button type="submit" className="edkut-btn-pink" disabled={submitting === "comment" || len(comment) > MESSAGE_MAX || !comment.trim()}>
              {submitting === "comment" ? "enviando..." : "publicar comentário"}
            </button>
          </div>
        </form>
      ) : (
        <p className="rounded-edkut border border-dashed border-edkut-border bg-white px-3.5 py-2.5 text-sm text-edkut-muted" data-testid="forum-cannot-post">{cannotPostReason}</p>
      )}
    </div>
  );
}
