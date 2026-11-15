// ---------------------------------------------------------------------------
// Scraps REAIS no navegador (Supabase, tabela public.scraps).
//   - enviar: INSERT (profile_owner_id, body[, parent_id]); author_id vem de auth.uid() (default da coluna);
//   - apagar: DELETE (a RLS permite só ao autor ou ao dono do perfil).
// A regra "só amigos podem enviar" vale no BANCO (migração 10, policy scraps_insert_own). A interface
// só esconde o formulário de quem não é amigo; mesmo que alguém force a chamada, o banco recusa (42501).
// RESPOSTAS (migração 11): scrap com parent_id apontando para um scrap raiz do MESMO perfil. Podem responder
// o dono do perfil e os amigos aceitos dele; conversa de um nível só (o banco recusa resposta a resposta).
// ---------------------------------------------------------------------------
import { createClient } from "@/lib/supabase/client";
import type { Scrap } from "@/types";

export const SCRAP_MAX_LENGTH = 1000;

export interface ScrapResult {
  ok: boolean;
  error?: string;
  scrap?: Scrap;
}

/** Tamanho em caracteres Unicode (igual ao char_length do Postgres). */
function charLength(value: string): number {
  return Array.from(value).length;
}

/** Devolve a mensagem de erro (pt-BR) ou null se o texto é válido. */
export function validateScrapBody(text: string): string | null {
  const body = text.trim();
  if (!body) return "Escreva uma mensagem antes de enviar.";
  if (charLength(body) > SCRAP_MAX_LENGTH) return `O recado pode ter no máximo ${SCRAP_MAX_LENGTH} caracteres.`;
  return null;
}

export function friendlyScrapError(error: { message?: string; code?: string }, isReply = false): string {
  const message = (error.message ?? "").toLowerCase();
  if (error.code === "42501" || message.includes("row-level security")) {
    return isReply
      ? "Somente o dono do perfil e os amigos dele podem responder a este recado."
      : "Somente amigos podem deixar recados. Envie uma solicitação de amizade e tente de novo quando for aceita.";
  }
  if (message.includes("scrap_reply_depth")) return "Só é possível responder ao recado original, não a uma resposta.";
  if (error.code === "23503" && isReply) return "O recado original não existe mais. Atualize a página.";
  if (error.code === "23514") return `O recado deve ter entre 1 e ${SCRAP_MAX_LENGTH} caracteres.`;
  if (error.code === "28000" || message.includes("jwt")) return "Sua sessão expirou. Entre novamente.";
  if (message.includes("failed to fetch") || message.includes("network")) {
    return "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.";
  }
  return "Não foi possível concluir a ação. Tente novamente.";
}

export interface ScrapRow {
  id: string;
  profile_owner_id: string;
  author_id: string;
  body: string;
  created_at: string;
  parent_id?: string | null;
}

/** Colunas lidas (exige a migração 11). */
export const SCRAP_COLUMNS = "id, profile_owner_id, author_id, body, created_at, parent_id";
/** Colunas anteriores à migração 11 (usadas só como reserva se o banco ainda não tiver parent_id). */
export const SCRAP_COLUMNS_LEGACY = "id, profile_owner_id, author_id, body, created_at";

export function rowToScrap(row: ScrapRow): Scrap {
  return {
    id: row.id,
    profileOwnerId: row.profile_owner_id,
    authorId: row.author_id,
    message: row.body,
    createdAt: row.created_at,
    parentId: row.parent_id ?? null,
  };
}

export interface ScrapThread {
  root: Scrap;
  /** Respostas em ordem cronológica (da mais antiga para a mais nova). */
  replies: Scrap[];
}

/**
 * Agrupa scraps em conversas: cada raiz (mais recente primeiro) com suas respostas (mais antiga primeiro).
 * Respostas cujo raiz não está na lista (por exemplo, fora do limite carregado) não são exibidas soltas.
 */
export function groupScrapThreads(scraps: Scrap[]): ScrapThread[] {
  const byTime = (a: Scrap, b: Scrap) => Date.parse(a.createdAt) - Date.parse(b.createdAt);
  const roots = scraps.filter((s) => !s.parentId).sort((a, b) => byTime(b, a));
  const repliesByParent = new Map<string, Scrap[]>();
  for (const s of scraps) {
    if (!s.parentId) continue;
    const list = repliesByParent.get(s.parentId) ?? [];
    list.push(s);
    repliesByParent.set(s.parentId, list);
  }
  return roots.map((root) => ({ root, replies: (repliesByParent.get(root.id) ?? []).sort(byTime) }));
}

/** Quem pode RESPONDER (a interface só decide o que mostrar; a regra real está na RLS): dono do perfil ou amigo dele. */
export function canReplyToScraps(isOwnProfile: boolean, friendshipStatus: string): boolean {
  return isOwnProfile || friendshipStatus === "friends";
}

export async function sendScrap(profileOwnerId: string, text: string, parentId?: string): Promise<ScrapResult> {
  const invalid = validateScrapBody(text);
  if (invalid) return { ok: false, error: invalid };
  const isReply = !!parentId;
  try {
    const supabase = createClient();
    const row: { profile_owner_id: string; body: string; parent_id?: string } = {
      profile_owner_id: profileOwnerId,
      body: text.trim(),
    };
    if (parentId) row.parent_id = parentId;
    const { data, error } = await supabase.from("scraps").insert(row).select(SCRAP_COLUMNS).single();
    if (error) return { ok: false, error: friendlyScrapError(error, isReply) };
    return { ok: true, scrap: rowToScrap(data as unknown as ScrapRow) };
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Variáveis do Supabase ausentes")) return { ok: false, error: e.message };
    return { ok: false, error: friendlyScrapError(e as { message?: string }, isReply) };
  }
}

export async function deleteScrap(scrapId: string): Promise<ScrapResult> {
  try {
    const supabase = createClient();
    const { error, count } = await supabase.from("scraps").delete({ count: "exact" }).eq("id", scrapId);
    if (error) return { ok: false, error: friendlyScrapError(error) };
    if (!count) return { ok: false, error: "Este recado já foi apagado ou você não tem permissão para apagá-lo. Atualize a página." };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyScrapError(e as { message?: string }) };
  }
}
