// ---------------------------------------------------------------------------
// Scraps (SOMENTE SERVIDOR): leitura real de public.scraps + perfis reais dos autores.
// Envio e exclusão ficam em lib/scraps.ts (navegador, protegidos por RLS). Sem dados fictícios:
// falha => `error: true` (a tela mostra aviso, nunca uma lista inventada).
// ---------------------------------------------------------------------------
import { createClient } from "@/lib/supabase/server";
import { getProfileUsersByIds } from "@/services/authService";
import { rowToScrap } from "@/lib/scraps";
import { isUuid } from "@/lib/uuid";
import type { Scrap, User } from "@/types";

/** Quantos scraps mais recentes são carregados por perfil. */
export const SCRAP_LIST_LIMIT = 50;

export interface ScrapsData {
  scraps: Scrap[];
  /** Perfis reais dos autores (para nome, avatar e link). */
  authors: User[];
  error: boolean;
}

export async function getScrapsWithAuthors(profileOwnerId: string): Promise<ScrapsData> {
  if (!isUuid(profileOwnerId)) return { scraps: [], authors: [], error: false };
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("scraps")
      .select("id, profile_owner_id, author_id, body, created_at")
      .eq("profile_owner_id", profileOwnerId)
      .order("created_at", { ascending: false })
      .limit(SCRAP_LIST_LIMIT);
    if (error) throw new Error(error.message);
    const scraps = ((data as unknown as Parameters<typeof rowToScrap>[0][] | null) ?? []).map(rowToScrap);
    const authors = await getProfileUsersByIds(scraps.map((s) => s.authorId));
    return { scraps, authors, error: false };
  } catch (e) {
    console.error("[scraps]", e instanceof Error ? e.message : "erro desconhecido");
    return { scraps: [], authors: [], error: true };
  }
}
