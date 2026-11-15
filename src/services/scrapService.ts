// ---------------------------------------------------------------------------
// Scraps (SOMENTE SERVIDOR): leitura real de public.scraps + perfis reais dos autores.
// Envio e exclusão ficam em lib/scraps.ts (navegador, protegidos por RLS). Sem dados fictícios:
// falha => `error: true` (a tela mostra aviso, nunca uma lista inventada).
// ---------------------------------------------------------------------------
import { createClient } from "@/lib/supabase/server";
import { getProfileUsersByIds } from "@/services/authService";
import { SCRAP_COLUMNS, SCRAP_COLUMNS_LEGACY, rowToScrap, type ScrapRow } from "@/lib/scraps";
import { isUuid } from "@/lib/uuid";
import type { Scrap, User } from "@/types";

/** Quantos scraps RAIZ mais recentes são carregados por perfil (as respostas deles vêm junto). */
export const SCRAP_LIST_LIMIT = 50;
/** Teto de respostas carregadas por perfil. */
export const SCRAP_REPLIES_LIMIT = 500;

export interface ScrapsData {
  scraps: Scrap[];
  /** Perfis reais dos autores (para nome, avatar e link). */
  authors: User[];
  error: boolean;
}

async function legacyScraps(profileOwnerId: string): Promise<ScrapsData> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scraps")
    .select(SCRAP_COLUMNS_LEGACY)
    .eq("profile_owner_id", profileOwnerId)
    .order("created_at", { ascending: false })
    .limit(SCRAP_LIST_LIMIT);
  if (error) throw new Error(error.message);
  const scraps = ((data as unknown as ScrapRow[] | null) ?? []).map(rowToScrap);
  const authors = await getProfileUsersByIds(scraps.map((s) => s.authorId));
  return { scraps, authors, error: false };
}

export async function getScrapsWithAuthors(profileOwnerId: string): Promise<ScrapsData> {
  if (!isUuid(profileOwnerId)) return { scraps: [], authors: [], error: false };
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("scraps")
      .select(SCRAP_COLUMNS)
      .eq("profile_owner_id", profileOwnerId)
      .is("parent_id", null)
      .order("created_at", { ascending: false })
      .limit(SCRAP_LIST_LIMIT);
    if (error) {
      // 42703 = coluna inexistente: o app subiu antes da migração 11. Mantém os recados visíveis (sem respostas).
      if (error.code === "42703") return await legacyScraps(profileOwnerId);
      throw new Error(error.message);
    }
    const roots = ((data as unknown as ScrapRow[] | null) ?? []).map(rowToScrap);
    let replies: Scrap[] = [];
    if (roots.length > 0) {
      const { data: replyData, error: replyError } = await supabase
        .from("scraps")
        .select(SCRAP_COLUMNS)
        .eq("profile_owner_id", profileOwnerId)
        .in("parent_id", roots.map((r) => r.id))
        .order("created_at", { ascending: true })
        .limit(SCRAP_REPLIES_LIMIT);
      if (replyError) throw new Error(replyError.message);
      replies = ((replyData as unknown as ScrapRow[] | null) ?? []).map(rowToScrap);
    }
    const scraps = [...roots, ...replies];
    const authors = await getProfileUsersByIds(scraps.map((s) => s.authorId));
    return { scraps, authors, error: false };
  } catch (e) {
    console.error("[scraps]", e instanceof Error ? e.message : "erro desconhecido");
    return { scraps: [], authors: [], error: true };
  }
}
