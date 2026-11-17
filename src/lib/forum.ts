// ---------------------------------------------------------------------------
// Fórum das comunidades REAL no navegador (Supabase, migração 15). As regras valem no BANCO (RLS + gatilhos):
//   - ler: qualquer usuário autenticado;
//   - criar tópico / comentar / responder: SÓ membro da comunidade (quem saiu ou foi removido perde na hora);
//   - responder: um nível só (resposta a comentário; o banco recusa resposta a resposta);
//   - apagar: o autor, ou o criador/moderador da comunidade. Não existe edição.
//   - limites de tamanho, texto normalizado e anti-repetição/frequência também são conferidos no banco.
// A interface só decide o que MOSTRAR; mesmo forçando a chamada, o banco recusa.
// O texto é sempre TEXTO PURO: a tela nunca interpreta HTML (React escapa) — só emoticons do EdKut.
// ---------------------------------------------------------------------------
import { createClient } from "@/lib/supabase/client";
import type { ForumAuthor, ForumMessage, ForumTopic } from "@/types";

export const TOPIC_TITLE_MIN = 3;
export const TOPIC_TITLE_MAX = 120;
export const TOPIC_BODY_MAX = 5000;
export const MESSAGE_MAX = 2000;
export const TOPICS_PAGE_SIZE = 20;
export const COMMENTS_PAGE_SIZE = 20;
/** Teto de respostas carregadas junto com uma página de comentários. */
export const REPLIES_LOAD_LIMIT = 500;

const TOPIC_COLUMNS = "id, community_id, author_id, title, body, reply_count, last_activity_at, created_at";
const MESSAGE_COLUMNS = "id, topic_id, parent_id, author_id, body, created_at";

export interface ForumResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

// ----------------------------- regras puras (testáveis) -----------------------------
const charLength = (v: string) => Array.from(v).length;
/** Mesma limpeza do banco: apara as pontas e descarta caracteres de controle (menos quebra de linha e tab). */
export function cleanForumText(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
}

export function validateTopic(title: string, body: string): string | null {
  const t = cleanForumText(title).replace(/\s+/g, " ");
  const b = cleanForumText(body);
  if (!t) return "Escreva um título para o tópico.";
  if (charLength(t) < TOPIC_TITLE_MIN) return `O título deve ter pelo menos ${TOPIC_TITLE_MIN} caracteres.`;
  if (charLength(t) > TOPIC_TITLE_MAX) return `O título pode ter no máximo ${TOPIC_TITLE_MAX} caracteres.`;
  if (!b) return "Escreva a mensagem inicial do tópico.";
  if (charLength(b) > TOPIC_BODY_MAX) return `A mensagem inicial pode ter no máximo ${TOPIC_BODY_MAX} caracteres.`;
  return null;
}

export function validateMessage(body: string): string | null {
  const b = cleanForumText(body);
  if (!b) return "Escreva uma mensagem antes de enviar.";
  if (charLength(b) > MESSAGE_MAX) return `A mensagem pode ter no máximo ${MESSAGE_MAX} caracteres.`;
  return null;
}

/** Quem vê o botão de apagar (a regra real é a RLS): o autor, ou criador/moderador da comunidade. */
export function canDeleteForumItem(userId: string, authorId: string | null, isModerator: boolean): boolean {
  return isModerator || (authorId !== null && authorId === userId);
}

export interface CommentThread {
  comment: ForumMessage;
  /** Respostas em ordem cronológica. */
  replies: ForumMessage[];
}

/** Agrupa comentários (ordem cronológica) com suas respostas. Respostas cujo comentário não foi carregado não aparecem soltas. */
export function groupCommentThreads(messages: ForumMessage[]): CommentThread[] {
  const byTime = (a: ForumMessage, b: ForumMessage) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id);
  const comments = messages.filter((m) => !m.parentId).sort(byTime);
  const repliesByParent = new Map<string, ForumMessage[]>();
  for (const m of messages) {
    if (!m.parentId) continue;
    const list = repliesByParent.get(m.parentId) ?? [];
    list.push(m);
    repliesByParent.set(m.parentId, list);
  }
  return comments.map((comment) => ({ comment, replies: (repliesByParent.get(comment.id) ?? []).sort(byTime) }));
}

/** Junta listas sem repetir ids (paginação por faixa pode repetir itens se algo novo chegar entre as páginas). */
export function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const seen = new Set(current.map((x) => x.id));
  return [...current, ...incoming.filter((x) => !seen.has(x.id))];
}

/** Atividade nas últimas 24 horas (indicador "ativo"). */
export function isRecentActivity(iso: string, now: number = Date.now()): boolean {
  const t = Date.parse(iso);
  return Number.isFinite(t) && now - t < 24 * 3600 * 1000 && now - t > -5 * 60 * 1000;
}

export type CommunityTab = "informacoes" | "forum" | "membros" | "administracao";

/** Valida a aba pedida na URL (?aba=forum). Qualquer outro valor cai em "informacoes". */
export function parseCommunityTab(value: string | undefined): CommunityTab {
  return value === "forum" || value === "membros" || value === "administracao" ? value : "informacoes";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Valida o ?topico= da URL (só UUID). */
export function parseTopicId(value: string | undefined): string | null {
  return value && UUID_RE.test(value) ? value : null;
}

export function forumHref(communityId: string, topicId?: string | null): string {
  return `/communities/${communityId}?aba=forum${topicId ? `&topico=${topicId}` : ""}`;
}

export function friendlyForumError(error: { message?: string; code?: string }, action: "post" | "delete" = "post"): string {
  const message = (error.message ?? "").toLowerCase();
  if (error.code === "42501" || message.includes("row-level security")) {
    return action === "delete"
      ? "Você não tem permissão para apagar isto."
      : "Somente membros da comunidade podem publicar no fórum. Entre na comunidade e tente de novo.";
  }
  if (message.includes("forum_rate_limit") || error.code === "54000") return "Você está publicando rápido demais. Aguarde um instante e tente de novo.";
  if (message.includes("forum_duplicate")) return "Você acabou de enviar esta mesma mensagem.";
  if (message.includes("forum_reply_depth")) return "Só é possível responder a um comentário, não a uma resposta.";
  if (error.code === "23503" || error.code === "P0002" || message.includes("forum_topic_not_found") || message.includes("forum_parent_not_found")) {
    return "O tópico ou o comentário não existe mais. Atualize a página.";
  }
  if (error.code === "23514") return "Confira os tamanhos: título de 3 a 120 caracteres, mensagem inicial até 5000 e comentários até 2000.";
  if (error.code === "28000" || message.includes("jwt")) return "Sua sessão expirou. Entre novamente.";
  if (message.includes("failed to fetch") || message.includes("network")) return "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.";
  return "Não foi possível concluir a ação. Tente novamente.";
}

// ----------------------------- linhas do banco -----------------------------
interface TopicRow {
  id: string; community_id: string; author_id: string | null; title: string; body: string;
  reply_count: number; last_activity_at: string; created_at: string;
}
interface MessageRow { id: string; topic_id: string; parent_id: string | null; author_id: string | null; body: string; created_at: string }

export const rowToTopic = (r: TopicRow): ForumTopic => ({
  id: r.id, communityId: r.community_id, authorId: r.author_id, title: r.title, body: r.body,
  replyCount: r.reply_count, lastActivityAt: r.last_activity_at, createdAt: r.created_at,
});
export const rowToMessage = (r: MessageRow): ForumMessage => ({
  id: r.id, topicId: r.topic_id, parentId: r.parent_id, authorId: r.author_id, body: r.body, createdAt: r.created_at,
});

function fail(e: unknown, action: "post" | "delete" | "load" = "post"): ForumResult<never> {
  if (e instanceof Error && e.message.startsWith("Variáveis do Supabase ausentes")) return { ok: false, error: e.message };
  const err = e as { message?: string; code?: string };
  return { ok: false, error: action === "load" ? "Não foi possível carregar o fórum agora. Atualize a página para tentar de novo." : friendlyForumError(err, action) };
}

// ----------------------------- leitura -----------------------------
/** Uma página de tópicos, do mais recentemente ativo ao mais antigo. `total` só na primeira página. */
export async function loadTopics(communityId: string, page: number): Promise<ForumResult<{ topics: ForumTopic[]; total: number | null; hasMore: boolean }>> {
  try {
    const supabase = createClient();
    const from = page * TOPICS_PAGE_SIZE;
    const { data, error, count } = await supabase
      .from("community_topics")
      .select(TOPIC_COLUMNS, page === 0 ? { count: "exact" } : undefined)
      .eq("community_id", communityId)
      .order("last_activity_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + TOPICS_PAGE_SIZE); // +1 item: descobre se há próxima página sem outra consulta
    if (error) return fail(error, "load");
    const rows = (data as unknown as TopicRow[] | null) ?? [];
    return { ok: true, data: { topics: rows.slice(0, TOPICS_PAGE_SIZE).map(rowToTopic), total: page === 0 ? count ?? null : null, hasMore: rows.length > TOPICS_PAGE_SIZE } };
  } catch (e) {
    return fail(e, "load");
  }
}

export async function loadTopic(communityId: string, topicId: string): Promise<ForumResult<ForumTopic | null>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("community_topics").select(TOPIC_COLUMNS).eq("id", topicId).eq("community_id", communityId).maybeSingle();
    if (error) return fail(error, "load");
    return { ok: true, data: data ? rowToTopic(data as unknown as TopicRow) : null };
  } catch (e) {
    return fail(e, "load");
  }
}

/** Uma página de comentários (mais antigos primeiro) + as respostas deles. */
export async function loadMessages(topicId: string, page: number): Promise<ForumResult<{ messages: ForumMessage[]; hasMore: boolean }>> {
  try {
    const supabase = createClient();
    const from = page * COMMENTS_PAGE_SIZE;
    const roots = await supabase
      .from("community_topic_replies")
      .select(MESSAGE_COLUMNS)
      .eq("topic_id", topicId)
      .is("parent_id", null)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + COMMENTS_PAGE_SIZE);
    if (roots.error) return fail(roots.error, "load");
    const rootRows = (roots.data as unknown as MessageRow[] | null) ?? [];
    const pageRoots = rootRows.slice(0, COMMENTS_PAGE_SIZE);
    let replies: MessageRow[] = [];
    if (pageRoots.length > 0) {
      const res = await supabase
        .from("community_topic_replies")
        .select(MESSAGE_COLUMNS)
        .in("parent_id", pageRoots.map((r) => r.id))
        .order("created_at", { ascending: true })
        .limit(REPLIES_LOAD_LIMIT);
      if (res.error) return fail(res.error, "load");
      replies = (res.data as unknown as MessageRow[] | null) ?? [];
    }
    return { ok: true, data: { messages: [...pageRoots, ...replies].map(rowToMessage), hasMore: rootRows.length > COMMENTS_PAGE_SIZE } };
  } catch (e) {
    return fail(e, "load");
  }
}

/** Busca nome e foto de quem ainda não é conhecido (uma consulta só). */
export async function loadAuthors(ids: string[]): Promise<ForumAuthor[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return [];
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("profiles").select("id, name, avatar_emoji, avatar_color, avatar_path").in("id", unique);
    if (error) return [];
    const rows = (data as unknown as { id: string; name: string; avatar_emoji: string; avatar_color: string; avatar_path: string | null }[] | null) ?? [];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      avatarEmoji: r.avatar_emoji,
      avatarColor: r.avatar_color,
      // só aceita foto dentro da pasta do próprio dono (o banco já garante por CHECK)
      avatarUrl: r.avatar_path && r.avatar_path.startsWith(`${r.id}/`) ? supabase.storage.from("avatars").getPublicUrl(r.avatar_path).data.publicUrl : undefined,
    }));
  } catch {
    return [];
  }
}

// ----------------------------- escrita -----------------------------
export async function createTopic(communityId: string, title: string, body: string): Promise<ForumResult<ForumTopic>> {
  const invalid = validateTopic(title, body);
  if (invalid) return { ok: false, error: invalid };
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("community_topics")
      .insert({ community_id: communityId, title: title.trim(), body: body.trim() })
      .select(TOPIC_COLUMNS)
      .single();
    if (error) return fail(error);
    return { ok: true, data: rowToTopic(data as unknown as TopicRow) };
  } catch (e) {
    return fail(e);
  }
}

export async function postMessage(topicId: string, body: string, parentId?: string): Promise<ForumResult<ForumMessage>> {
  const invalid = validateMessage(body);
  if (invalid) return { ok: false, error: invalid };
  try {
    const supabase = createClient();
    const row: { topic_id: string; body: string; parent_id?: string } = { topic_id: topicId, body: body.trim() };
    if (parentId) row.parent_id = parentId;
    const { data, error } = await supabase.from("community_topic_replies").insert(row).select(MESSAGE_COLUMNS).single();
    if (error) return fail(error);
    return { ok: true, data: rowToMessage(data as unknown as MessageRow) };
  } catch (e) {
    return fail(e);
  }
}

async function deleteRow(table: "community_topics" | "community_topic_replies", id: string): Promise<ForumResult> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from(table).delete().eq("id", id).select("id");
    if (error) return fail(error, "delete");
    // A RLS não gera erro quando a linha não é visível/apagável: 0 linhas = sem permissão ou já apagado.
    if (!data || (data as unknown[]).length === 0) return { ok: false, error: "Não foi possível apagar: você não tem permissão ou o item já foi apagado." };
    return { ok: true };
  } catch (e) {
    return fail(e, "delete");
  }
}

export const deleteTopic = (id: string) => deleteRow("community_topics", id);
export const deleteMessage = (id: string) => deleteRow("community_topic_replies", id);
