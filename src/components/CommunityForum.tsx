"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EmoticonText } from "./Emoticon";
import { EmoticonTextarea } from "./EmoticonTextarea";
import { ForumAuthorBadge, formatDateTime } from "./ForumAuthor";
import { ForumTopicView } from "./ForumTopicView";
import { formatRelativeTime } from "@/lib/format";
import {
  TOPIC_BODY_MAX,
  TOPIC_TITLE_MAX,
  createTopic,
  forumHref,
  isRecentActivity,
  loadAuthors,
  loadTopics,
  mergeById,
  validateTopic,
} from "@/lib/forum";
import type { ForumAuthor, ForumTopic, User } from "@/types";

type View = { kind: "list" } | { kind: "new" } | { kind: "topic"; id: string };

interface CommunityForumProps {
  communityId: string;
  currentUser: User;
  /** Membro ativo (criador, moderador ou participante): só eles publicam (regra real: RLS). */
  isMember: boolean;
  isModerator: boolean;
  /** Solicitação de entrada pendente. */
  pending: boolean;
  /** Quem a página já conhece (membros): evita consultas de autores. */
  knownAuthors: User[];
  initialTopicId?: string | null;
}

const len = (v: string) => Array.from(v).length;
const toAuthor = (u: User): ForumAuthor => ({ id: u.id, name: u.name, avatarEmoji: u.avatarEmoji, avatarColor: u.avatarColor, avatarUrl: u.avatarUrl });

/** Mantém a URL (?aba=forum&topico=) em sincronia, para o F5 voltar ao mesmo lugar. Falha silenciosa (ex.: prévia). */
function syncUrl(communityId: string, topicId?: string | null) {
  try {
    window.history.replaceState(null, "", forumHref(communityId, topicId));
  } catch {
    /* sem histórico disponível */
  }
}

export function CommunityForum({ communityId, currentUser, isMember, isModerator, pending, knownAuthors, initialTopicId = null }: CommunityForumProps) {
  const [view, setView] = useState<View>(initialTopicId ? { kind: "topic", id: initialTopicId } : { kind: "list" });
  const [authors, setAuthors] = useState<Map<string, ForumAuthor>>(() => new Map([currentUser, ...knownAuthors].map((u) => [u.id, toAuthor(u)])));
  const authorsRef = useRef(authors);
  authorsRef.current = authors;

  const ensureAuthors = useCallback(async (ids: (string | null)[]) => {
    const missing = Array.from(new Set(ids.filter((id): id is string => !!id && !authorsRef.current.has(id))));
    if (missing.length === 0) return;
    const fetched = await loadAuthors(missing);
    if (fetched.length === 0) return;
    setAuthors((prev) => {
      const next = new Map(prev);
      for (const a of fetched) next.set(a.id, a);
      return next;
    });
  }, []);

  const cannotPostReason = pending
    ? "Sua solicitação de entrada está aguardando aprovação. Quando for aprovada, você poderá participar do fórum."
    : "Entre na comunidade para criar tópicos e comentar.";

  const go = (next: View) => {
    setView(next);
    syncUrl(communityId, next.kind === "topic" ? next.id : null);
  };

  const [notice, setNotice] = useState<string | null>(null);

  if (view.kind === "topic") {
    return (
      <ForumTopicView
        key={view.id}
        communityId={communityId}
        topicId={view.id}
        currentUserId={currentUser.id}
        isMember={isMember}
        isModerator={isModerator}
        cannotPostReason={cannotPostReason}
        authors={authors}
        ensureAuthors={ensureAuthors}
        onBack={() => go({ kind: "list" })}
        onTopicDeleted={() => {
          setNotice("Tópico apagado.");
          go({ kind: "list" });
        }}
      />
    );
  }
  if (view.kind === "new") {
    return (
      <NewTopicForm
        communityId={communityId}
        onCancel={() => go({ kind: "list" })}
        onCreated={(t) => {
          setNotice(null);
          go({ kind: "topic", id: t.id });
        }}
      />
    );
  }
  return (
    <TopicList
      communityId={communityId}
      canCreate={isMember}
      cannotPostReason={cannotPostReason}
      authors={authors}
      ensureAuthors={ensureAuthors}
      notice={notice}
      onCreate={() => go({ kind: "new" })}
      onOpen={(id) => go({ kind: "topic", id })}
    />
  );
}

// ------------------------------------------------------------------ lista de tópicos
function TopicList({ communityId, canCreate, cannotPostReason, authors, ensureAuthors, notice, onCreate, onOpen }: {
  communityId: string;
  canCreate: boolean;
  cannotPostReason: string;
  authors: Map<string, ForumAuthor>;
  ensureAuthors: (ids: (string | null)[]) => Promise<void>;
  notice: string | null;
  onCreate: () => void;
  onOpen: (id: string) => void;
}) {
  const [topics, setTopics] = useState<ForumTopic[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setTopics(null);
    const res = await loadTopics(communityId, 0);
    if (!res.ok || !res.data) return setError(res.error ?? "Não foi possível carregar o fórum.");
    setTopics(res.data.topics);
    setTotal(res.data.total);
    setPage(0);
    setHasMore(res.data.hasMore);
    await ensureAuthors(res.data.topics.map((t) => t.authorId));
  }, [communityId, ensureAuthors]);

  useEffect(() => {
    void load();
  }, [load]);

  async function more() {
    if (loadingMore) return;
    setLoadingMore(true);
    const res = await loadTopics(communityId, page + 1);
    setLoadingMore(false);
    if (!res.ok || !res.data) return setError(res.error ?? "Não foi possível carregar mais tópicos.");
    const incoming = res.data.topics;
    setTopics((prev) => mergeById(prev ?? [], incoming));
    setPage((p) => p + 1);
    setHasMore(res.data.hasMore);
    await ensureAuthors(incoming.map((t) => t.authorId));
  }

  return (
    <div className="flex flex-col gap-3" data-testid="forum-list">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-base font-bold text-edkut-blue">
          fórum{total !== null ? ` (${total} ${total === 1 ? "tópico" : "tópicos"})` : ""}
        </h2>
        {canCreate && (
          <button type="button" className="edkut-btn-pink" onClick={onCreate}>criar tópico</button>
        )}
      </div>

      {!canCreate && <p className="text-xs text-edkut-muted" data-testid="forum-cannot-post">{cannotPostReason}</p>}
      {notice && <p role="status" className="rounded-edkut border border-edkut-borderStrong bg-edkut-blueSoft px-3 py-2 text-sm text-edkut-blue">{notice}</p>}
      {error && (
        <div className="flex flex-col gap-2">
          <p role="alert" className="rounded-edkut border border-edkut-pink bg-edkut-pinkSoft px-3 py-2 text-sm text-edkut-pinkDark">{error}</p>
          <button type="button" className="edkut-btn-outline self-start" onClick={() => void load()}>tentar de novo</button>
        </div>
      )}

      {topics === null && !error && <p className="text-sm text-edkut-muted" role="status">Carregando tópicos...</p>}

      {topics !== null && topics.length === 0 && !error && (
        <div className="edkut-card p-4 text-sm text-edkut-muted" data-testid="forum-empty">
          Este fórum ainda não tem tópicos.{canCreate ? " Que tal criar o primeiro?" : ""}
        </div>
      )}

      {topics !== null && topics.length > 0 && (
        <div className="edkut-card">
          <div className="hidden grid-cols-[minmax(0,1fr)_70px_150px] gap-3 border-b border-edkut-border bg-edkut-blueSoft px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-edkut-muted sm:grid">
            <span>tópico</span>
            <span className="text-center">mensagens</span>
            <span>última atividade</span>
          </div>
          <ul className="divide-y divide-edkut-border">
            {topics.map((t, i) => {
              const recent = isRecentActivity(t.lastActivityAt);
              return (
                <li key={t.id} className={`grid grid-cols-1 gap-x-3 gap-y-1 px-3.5 py-2 sm:grid-cols-[minmax(0,1fr)_70px_150px] sm:items-center ${i % 2 === 0 ? "bg-white" : "bg-edkut-blueSoft"}`} data-testid="forum-topic-row">
                  <div className="min-w-0">
                    <button type="button" className="edkut-link block max-w-full text-left font-heading text-sm font-bold [overflow-wrap:anywhere]" onClick={() => onOpen(t.id)}>
                      <EmoticonText text={t.title} />
                    </button>
                    <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-edkut-muted">
                      <span>por</span>
                      <ForumAuthorBadge author={t.authorId ? authors.get(t.authorId) : undefined} />
                      <span>· {formatDateTime(t.createdAt)}</span>
                    </p>
                  </div>
                  <p className="text-xs text-edkut-muted sm:text-center">
                    <span className="font-heading text-sm font-bold text-edkut-blue" data-testid="topic-replies">{t.replyCount}</span>
                    <span className="sm:hidden"> {t.replyCount === 1 ? "mensagem" : "mensagens"}</span>
                  </p>
                  <p className="flex items-center gap-1.5 text-[11px] text-edkut-muted">
                    {recent && <span className="h-2 w-2 shrink-0 rounded-full bg-edkut-pink" title="atividade nas últimas 24 horas" data-testid="recent-dot" />}
                    {formatRelativeTime(t.lastActivityAt)}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {hasMore && (
        <button type="button" className="edkut-btn-outline self-center" onClick={() => void more()} disabled={loadingMore}>
          {loadingMore ? "carregando..." : "carregar mais tópicos"}
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ novo tópico
function NewTopicForm({ communityId, onCancel, onCreated }: { communityId: string; onCancel: () => void; onCreated: (t: ForumTopic) => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const busyRef = useRef(false);

  async function submit() {
    if (busyRef.current) return;
    const invalid = validateTopic(title, body);
    if (invalid) return setError(invalid);
    busyRef.current = true;
    setSubmitting(true);
    setError(null);
    const res = await createTopic(communityId, title, body);
    busyRef.current = false;
    setSubmitting(false);
    if (!res.ok || !res.data) return setError(res.error ?? "Não foi possível criar o tópico.");
    onCreated(res.data);
  }

  return (
    <form aria-label="Criar tópico" onSubmit={(e) => { e.preventDefault(); void submit(); }} className="edkut-card" data-testid="forum-new">
      <div className="edkut-card-title">criar tópico</div>
      <div className="flex flex-col gap-3 p-3.5">
        <div>
          <label htmlFor="topic-title" className="mb-1 block text-xs font-semibold text-edkut-muted">título</label>
          <input
            id="topic-title"
            className="edkut-input w-full"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setError(null); }}
            disabled={submitting}
            placeholder="Sobre o que você quer conversar?"
            aria-invalid={error ? true : undefined}
            autoComplete="off"
          />
          <p className={`mt-0.5 text-right text-[11px] ${len(title) > TOPIC_TITLE_MAX ? "font-bold text-edkut-pinkDark" : "text-edkut-muted"}`}>{len(title)}/{TOPIC_TITLE_MAX}</p>
        </div>
        <div>
          <span className="mb-1 block text-xs font-semibold text-edkut-muted">mensagem</span>
          <EmoticonTextarea value={body} onChange={(v) => { setBody(v); setError(null); }} placeholder="Escreva a mensagem inicial..." ariaLabel="Mensagem inicial do tópico" disabled={submitting} invalid={!!error} rows={6} />
          <p className={`mt-0.5 text-right text-[11px] ${len(body) > TOPIC_BODY_MAX ? "font-bold text-edkut-pinkDark" : "text-edkut-muted"}`}>{len(body)}/{TOPIC_BODY_MAX}</p>
        </div>
        {error && <p role="alert" className="rounded-edkut border border-edkut-pink bg-edkut-pinkSoft px-3 py-2 text-sm text-edkut-pinkDark">{error}</p>}
        <div className="flex items-center justify-end gap-3">
          <button type="button" className="edkut-link text-sm" onClick={onCancel} disabled={submitting}>cancelar</button>
          <button type="submit" className="edkut-btn-pink" disabled={submitting || !title.trim() || !body.trim() || len(title) > TOPIC_TITLE_MAX || len(body) > TOPIC_BODY_MAX}>
            {submitting ? "publicando..." : "publicar tópico"}
          </button>
        </div>
      </div>
    </form>
  );
}
