// ---------------------------------------------------------------------------
// Comunidades REAIS no navegador (Supabase). As regras valem no BANCO (migrações 4, 12 e 13):
//   - criar: INSERT em communities (criador = auth.uid(); vira moderador por gatilho);
//   - entrar: INSERT em community_members, SÓ em comunidade aberta (RLS);
//   - solicitar / cancelar / decidir: funções SECURITY DEFINER (rpc) — não há INSERT/UPDATE direto;
//   - editar dados e tipo de entrada: só o criador (RLS); promover/rebaixar: só o criador;
//   - remover participante comum: criador ou moderador; sair: qualquer membro, menos o criador.
// A interface só decide o que MOSTRAR; mesmo forçando a chamada, o banco recusa.
// ---------------------------------------------------------------------------
import { createClient } from "@/lib/supabase/client";
import { validateAvatarFile } from "@/lib/avatarUpload";
import type { CommunityInfo, CommunityRole, JoinPolicy } from "@/types";

export const COMMUNITY_NAME_MIN = 3;
export const COMMUNITY_NAME_MAX = 80;
export const COMMUNITY_DESCRIPTION_MAX = 300;
export const COMMUNITY_LONG_DESCRIPTION_MAX = 2000;
export const COMMUNITY_IMAGE_BUCKET = "community-images";
export const COMMUNITY_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

export const JOIN_POLICY_LABEL: Record<JoinPolicy, string> = {
  open: "entrada aberta",
  approval: "entrada com aprovação",
};

export interface CommunityResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

export interface CommunityFields {
  name: string;
  description: string;
  longDescription: string;
  category: string;
  joinPolicy: JoinPolicy;
}

function charLength(value: string): number {
  return Array.from(value).length;
}

/** Devolve a mensagem de erro (pt-BR) ou null se os campos são válidos (mesmos limites do banco). */
export function validateCommunityFields(f: CommunityFields): string | null {
  const name = f.name.trim();
  const description = f.description.trim();
  if (charLength(name) < COMMUNITY_NAME_MIN || charLength(name) > COMMUNITY_NAME_MAX) {
    return `O nome deve ter de ${COMMUNITY_NAME_MIN} a ${COMMUNITY_NAME_MAX} caracteres.`;
  }
  if (!description) return "Escreva uma descrição curta da comunidade.";
  if (charLength(description) > COMMUNITY_DESCRIPTION_MAX) {
    return `A descrição curta pode ter no máximo ${COMMUNITY_DESCRIPTION_MAX} caracteres.`;
  }
  if (charLength(f.longDescription.trim()) > COMMUNITY_LONG_DESCRIPTION_MAX) {
    return `A descrição completa pode ter no máximo ${COMMUNITY_LONG_DESCRIPTION_MAX} caracteres.`;
  }
  if (!f.category) return "Escolha uma categoria.";
  if (f.joinPolicy !== "open" && f.joinPolicy !== "approval") return "Escolha o tipo de entrada.";
  return null;
}

export type CommunityErrorContext = "join" | "generic";

export function friendlyCommunityError(error: { message?: string; code?: string }, ctx: CommunityErrorContext = "generic"): string {
  const message = (error.message ?? "").toLowerCase();
  if (message.includes("already_member")) return "Você já participa desta comunidade.";
  if (message.includes("request_already_pending")) return "Você já tem uma solicitação pendente para esta comunidade.";
  if (message.includes("community_is_open")) return "Esta comunidade agora é aberta. Atualize a página e entre diretamente.";
  if (message.includes("request_not_pending")) return "Esta solicitação já foi decidida. Atualize a página.";
  if (message.includes("request_not_found")) return "Esta solicitação não existe mais. Atualize a página.";
  if (message.includes("not_moderator")) return "Somente o criador e os moderadores podem decidir solicitações.";
  if (message.includes("community_not_found")) return "Esta comunidade não existe mais.";
  if (error.code === "42501" || message.includes("row-level security") || message.includes("permission denied")) {
    return ctx === "join"
      ? "Esta comunidade exige aprovação. Solicite participação e aguarde a decisão."
      : "Você não tem permissão para esta ação.";
  }
  if (error.code === "23505") return "Você já participa desta comunidade.";
  if (error.code === "23514") {
    return `Confira os campos: nome de ${COMMUNITY_NAME_MIN} a ${COMMUNITY_NAME_MAX} caracteres e descrição curta de 1 a ${COMMUNITY_DESCRIPTION_MAX}.`;
  }
  if (error.code === "28000" || message.includes("jwt")) return "Sua sessão expirou. Entre novamente.";
  if (message.includes("failed to fetch") || message.includes("network")) {
    return "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.";
  }
  return "Não foi possível concluir a ação. Tente novamente.";
}

function fail(e: unknown, ctx: CommunityErrorContext = "generic"): CommunityResult<never> {
  if (e instanceof Error && e.message.startsWith("Variáveis do Supabase ausentes")) return { ok: false, error: e.message };
  return { ok: false, error: friendlyCommunityError(e as { message?: string; code?: string }, ctx) };
}

// ------------------------------ leitura (mapeamento) ------------------------------

export interface CommunityRow {
  id: string;
  name: string;
  description: string;
  long_description: string | null;
  category: string;
  emoji: string;
  color: string;
  image_path?: string | null;
  join_policy: JoinPolicy;
  creator_id: string | null;
  member_count: number;
  created_at: string;
}

/** Colunas lidas (exige as migrações 12 e 13). */
export const COMMUNITY_COLUMNS =
  "id, name, description, long_description, category, emoji, color, image_path, join_policy, creator_id, member_count, created_at";
/** Sem image_path (migração 13 ainda não aplicada). */
export const COMMUNITY_COLUMNS_NO_IMAGE =
  "id, name, description, long_description, category, emoji, color, join_policy, creator_id, member_count, created_at";

/** Monta a URL pública da imagem; só aceita caminhos dentro da pasta da própria comunidade. */
export function communityImageUrl(
  getPublicUrl: (bucket: string, path: string) => string,
  id: string,
  path: string | null | undefined
): string | undefined {
  // Mesmo formato exigido pelo banco: <id>/<arquivo>.(jpg|png|webp), sem subpastas nem "..".
  if (!path || !path.startsWith(`${id}/`)) return undefined;
  if (!/^[A-Za-z0-9._-]+\.(jpg|png|webp)$/.test(path.slice(id.length + 1))) return undefined;
  return getPublicUrl(COMMUNITY_IMAGE_BUCKET, path);
}

export function rowToCommunity(row: CommunityRow, imageUrl?: string): CommunityInfo {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    longDescription: row.long_description ?? undefined,
    category: row.category,
    emoji: row.emoji,
    color: row.color,
    imageUrl,
    joinPolicy: row.join_policy,
    creatorId: row.creator_id,
    memberCount: row.member_count,
    createdAt: row.created_at,
  };
}

function browserImageUrl(row: CommunityRow): string | undefined {
  const supabase = createClient();
  return communityImageUrl(
    (bucket, path) => supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl,
    row.id,
    row.image_path
  );
}

// ------------------------------ funções puras de tela ------------------------------

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Busca por nome ou descrição (sem acentos, sem diferenciar maiúsculas) e filtro de categoria. */
export function filterCommunities(list: CommunityInfo[], query: string, category: string): CommunityInfo[] {
  const q = normalize(query.trim());
  return list.filter((c) => {
    if (category && category !== "Todas" && c.category !== category) return false;
    if (!q) return true;
    return normalize(c.name).includes(q) || normalize(c.description).includes(q);
  });
}

export type MyStatus = "creator" | "moderator" | "member" | "pending" | "none";

export function myStatusIn(
  community: CommunityInfo,
  userId: string,
  role: CommunityRole | undefined,
  hasPendingRequest: boolean
): MyStatus {
  if (community.creatorId === userId) return "creator";
  if (role === "moderator") return "moderator";
  if (role === "member") return "member";
  return hasPendingRequest ? "pending" : "none";
}

export const canModerate = (s: MyStatus) => s === "creator" || s === "moderator";
export const isMemberStatus = (s: MyStatus) => s === "creator" || s === "moderator" || s === "member";

// ------------------------------ imagem ------------------------------

const IMAGE_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function friendlyImageError(error: { message?: string; statusCode?: string | number }): string {
  const m = (error.message ?? "").toLowerCase();
  if (m.includes("exceeded") || m.includes("too large") || String(error.statusCode) === "413") return "A imagem é grande demais. O limite é de 2 MB.";
  if (m.includes("mime") || m.includes("not allowed")) return "Formato não aceito. Envie uma imagem JPEG, PNG ou WebP.";
  if (m.includes("row-level security") || m.includes("unauthorized") || m.includes("policy")) {
    return "Sem permissão para enviar a imagem (somente o criador). Confira se a migração 13 foi aplicada.";
  }
  if (m.includes("bucket not found")) return "O armazenamento de imagens ainda não foi configurado (migração 13).";
  return "Não foi possível salvar a imagem. Tente novamente.";
}

/** Envia a imagem, grava o caminho em communities.image_path e apaga a anterior (melhor esforço). */
export async function setCommunityImage(communityId: string, file: File): Promise<CommunityResult<string>> {
  try {
    const check = await validateAvatarFile(file);
    if (!check.ok) return { ok: false, error: check.error };
    const supabase = createClient();
    const unique = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
    const path = `${communityId}/${unique}.${IMAGE_EXT[file.type]}`;

    const { data: before } = await supabase.from("communities").select("image_path").eq("id", communityId).maybeSingle();
    const oldPath = (before as { image_path?: string | null } | null)?.image_path ?? null;

    const { error: uploadError } = await supabase.storage
      .from(COMMUNITY_IMAGE_BUCKET)
      .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
    if (uploadError) return { ok: false, error: friendlyImageError(uploadError) };

    const { data, error } = await supabase.from("communities").update({ image_path: path }).eq("id", communityId).select("id");
    if (error || !data || (data as unknown[]).length === 0) {
      await supabase.storage.from(COMMUNITY_IMAGE_BUCKET).remove([path]); // não deixa arquivo órfão
      return { ok: false, error: "Não foi possível salvar a imagem. Somente o criador pode alterá-la." };
    }
    if (oldPath && oldPath.startsWith(`${communityId}/`) && oldPath !== path) {
      await supabase.storage.from(COMMUNITY_IMAGE_BUCKET).remove([oldPath]);
    }
    return { ok: true, data: supabase.storage.from(COMMUNITY_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl };
  } catch (e) {
    return fail(e);
  }
}

export async function removeCommunityImage(communityId: string): Promise<CommunityResult> {
  try {
    const supabase = createClient();
    const { data: before } = await supabase.from("communities").select("image_path").eq("id", communityId).maybeSingle();
    const oldPath = (before as { image_path?: string | null } | null)?.image_path ?? null;
    const { data, error } = await supabase.from("communities").update({ image_path: null }).eq("id", communityId).select("id");
    if (error || !data || (data as unknown[]).length === 0) return { ok: false, error: "Somente o criador pode remover a imagem." };
    if (oldPath && oldPath.startsWith(`${communityId}/`)) await supabase.storage.from(COMMUNITY_IMAGE_BUCKET).remove([oldPath]);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------ mutações ------------------------------

export async function createCommunity(fields: CommunityFields, image?: File | null): Promise<CommunityResult<{ community: CommunityInfo; imageError?: string }>> {
  const invalid = validateCommunityFields(fields);
  if (invalid) return { ok: false, error: invalid };
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("communities")
      .insert({
        name: fields.name.trim(),
        description: fields.description.trim(),
        long_description: fields.longDescription.trim() || null,
        category: fields.category,
        join_policy: fields.joinPolicy,
      })
      .select(COMMUNITY_COLUMNS_NO_IMAGE)
      .single();
    if (error) return { ok: false, error: friendlyCommunityError(error) };
    let community = rowToCommunity(data as unknown as CommunityRow);
    let imageError: string | undefined;
    if (image) {
      // A imagem precisa do id da comunidade: é enviada depois da criação. Se falhar, a comunidade já existe.
      const up = await setCommunityImage(community.id, image);
      if (up.ok) community = { ...community, imageUrl: up.data };
      else imageError = up.error;
    }
    return { ok: true, data: { community, imageError } };
  } catch (e) {
    return fail(e);
  }
}

/** Só o criador (RLS). 0 linhas => sem permissão. Imagem é tratada à parte. */
export async function updateCommunity(id: string, fields: CommunityFields): Promise<CommunityResult<CommunityInfo>> {
  const invalid = validateCommunityFields(fields);
  if (invalid) return { ok: false, error: invalid };
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("communities")
      .update({
        name: fields.name.trim(),
        description: fields.description.trim(),
        long_description: fields.longDescription.trim() || null,
        category: fields.category,
        join_policy: fields.joinPolicy,
      })
      .eq("id", id)
      .select(COMMUNITY_COLUMNS);
    if (error) return { ok: false, error: friendlyCommunityError(error) };
    const row = ((data as unknown as CommunityRow[] | null) ?? [])[0];
    if (!row) return { ok: false, error: "Somente o criador pode editar a comunidade." };
    return { ok: true, data: rowToCommunity(row, browserImageUrl(row)) };
  } catch (e) {
    return fail(e);
  }
}

/** Entrada direta (comunidade ABERTA). Em comunidade com aprovação o banco recusa (42501). */
export async function joinCommunity(communityId: string): Promise<CommunityResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from("community_members").insert({ community_id: communityId });
    if (error) return { ok: false, error: friendlyCommunityError(error, "join") };
    return { ok: true };
  } catch (e) {
    return fail(e, "join");
  }
}

/** Sair, ou remover um participante comum (criador/moderador). O criador não pode sair. */
export async function removeMembership(communityId: string, userId: string): Promise<CommunityResult> {
  try {
    const supabase = createClient();
    const { error, count } = await supabase
      .from("community_members")
      .delete({ count: "exact" })
      .eq("community_id", communityId)
      .eq("user_id", userId);
    if (error) return { ok: false, error: friendlyCommunityError(error) };
    if (!count) return { ok: false, error: "Não foi possível remover: o participante já saiu ou você não tem permissão (o criador não pode sair e moderadores só removem participantes comuns)." };
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Promover ou rebaixar: só o criador (RLS). 0 linhas => sem permissão. */
export async function setMemberRole(communityId: string, userId: string, role: CommunityRole): Promise<CommunityResult> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("community_members")
      .update({ role })
      .eq("community_id", communityId)
      .eq("user_id", userId)
      .select("user_id");
    if (error) return { ok: false, error: friendlyCommunityError(error) };
    if (!data || (data as unknown[]).length === 0) return { ok: false, error: "Somente o criador pode definir moderadores." };
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function requestJoin(communityId: string): Promise<CommunityResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.rpc("request_community_join", { p_community: communityId });
    if (error) return { ok: false, error: friendlyCommunityError(error) };
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelJoinRequest(communityId: string): Promise<CommunityResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.rpc("cancel_community_join_request", { p_community: communityId });
    if (error) return { ok: false, error: friendlyCommunityError(error) };
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function decideJoinRequest(requestId: string, approve: boolean): Promise<CommunityResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.rpc("decide_community_join_request", { p_request: requestId, p_approve: approve });
    if (error) return { ok: false, error: friendlyCommunityError(error) };
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
