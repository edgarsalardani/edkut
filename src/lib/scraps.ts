// ---------------------------------------------------------------------------
// Scraps REAIS no navegador (Supabase, tabela public.scraps).
//   - enviar: INSERT (profile_owner_id, body); author_id vem de auth.uid() (default da coluna);
//   - apagar: DELETE (a RLS permite só ao autor ou ao dono do perfil).
// A regra "só amigos podem enviar" vale no BANCO (migração 10, policy scraps_insert_own). A interface
// só esconde o formulário de quem não é amigo; mesmo que alguém force a chamada, o banco recusa (42501).
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

export function friendlyScrapError(error: { message?: string; code?: string }): string {
  const message = (error.message ?? "").toLowerCase();
  if (error.code === "42501" || message.includes("row-level security")) {
    return "Somente amigos podem deixar recados. Envie uma solicitação de amizade e tente de novo quando for aceita.";
  }
  if (error.code === "23514") return `O recado deve ter entre 1 e ${SCRAP_MAX_LENGTH} caracteres.`;
  if (error.code === "28000" || message.includes("jwt")) return "Sua sessão expirou. Entre novamente.";
  if (message.includes("failed to fetch") || message.includes("network")) {
    return "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.";
  }
  return "Não foi possível concluir a ação. Tente novamente.";
}

interface ScrapRow {
  id: string;
  profile_owner_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export function rowToScrap(row: ScrapRow): Scrap {
  return { id: row.id, profileOwnerId: row.profile_owner_id, authorId: row.author_id, message: row.body, createdAt: row.created_at };
}

export async function sendScrap(profileOwnerId: string, text: string): Promise<ScrapResult> {
  const invalid = validateScrapBody(text);
  if (invalid) return { ok: false, error: invalid };
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("scraps")
      .insert({ profile_owner_id: profileOwnerId, body: text.trim() })
      .select("id, profile_owner_id, author_id, body, created_at")
      .single();
    if (error) return { ok: false, error: friendlyScrapError(error) };
    return { ok: true, scrap: rowToScrap(data as unknown as ScrapRow) };
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Variáveis do Supabase ausentes")) return { ok: false, error: e.message };
    return { ok: false, error: friendlyScrapError(e as { message?: string }) };
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
