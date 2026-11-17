// ---------------------------------------------------------------------------
// Home (SOMENTE SERVIDOR): resumo REAL das interações do usuário logado — últimos recados recebidos, solicitações de
// amizade pendentes e depoimentos aguardando aprovação. Nada é fictício: se uma consulta falhar, o valor vem como
// null/[] e a tela mostra "–" ou o estado vazio. Status, contadores e comunidades vêm de getProfileSummary (o mesmo
// serviço do perfil clássico); NÃO há tabela nova nem migração.
// ---------------------------------------------------------------------------
import { createClient } from "@/lib/supabase/server";
import { getProfileUsersByIds } from "@/services/authService";
import { getPendingRequests } from "@/services/socialService";
import type { PendingRequestWithUser } from "@/services/friendService";
import { getProfileSummary } from "@/services/profileClassicService";
import { SCRAP_COLUMNS, SCRAP_COLUMNS_LEGACY, rowToScrap, type ScrapRow } from "@/lib/scraps";
import { isUuid } from "@/lib/uuid";
import type { Scrap, User } from "@/types";

export const HOME_RECENT_SCRAPS = 3;
export const HOME_PENDING_SHOWN = 3;

export interface HomeData {
  summary: Awaited<ReturnType<typeof getProfileSummary>>;
  recentScraps: { scrap: Scrap; author: User | undefined }[];
  pendingRequests: PendingRequestWithUser[];
  /** null = não foi possível contar. */
  pendingTestimonials: number | null;
}

async function recentScrapsOf(userId: string): Promise<{ scrap: Scrap; author: User | undefined }[]> {
  const supabase = createClient();
  let res = await supabase
    .from("scraps")
    .select(SCRAP_COLUMNS)
    .eq("profile_owner_id", userId)
    .is("parent_id", null)
    .order("created_at", { ascending: false })
    .limit(HOME_RECENT_SCRAPS);
  if (res.error?.code === "42703") {
    // migração 11 pendente: sem parent_id
    res = await supabase.from("scraps").select(SCRAP_COLUMNS_LEGACY).eq("profile_owner_id", userId).order("created_at", { ascending: false }).limit(HOME_RECENT_SCRAPS);
  }
  if (res.error) throw new Error(res.error.message);
  const scraps = ((res.data as unknown as ScrapRow[] | null) ?? []).map(rowToScrap);
  const authors = await getProfileUsersByIds(scraps.map((s) => s.authorId));
  const byId = new Map(authors.map((u) => [u.id, u]));
  return scraps.map((scrap) => ({ scrap, author: byId.get(scrap.authorId) }));
}

async function pendingTestimonialsOf(userId: string): Promise<number | null> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("testimonials")
    .select("id", { count: "exact", head: true })
    .eq("profile_owner_id", userId)
    .eq("status", "pending");
  return error ? null : count ?? 0;
}

export async function getHomeData(userId: string): Promise<HomeData> {
  const empty: HomeData = { summary: await getProfileSummary(userId), recentScraps: [], pendingRequests: [], pendingTestimonials: null };
  if (!isUuid(userId)) return { ...empty, pendingTestimonials: 0 };
  const safe = async <T,>(label: string, run: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await run();
    } catch (e) {
      console.error(`[home-${label}]`, e instanceof Error ? e.message : "erro desconhecido");
      return fallback;
    }
  };
  const [recentScraps, pendingRequests, pendingTestimonials] = await Promise.all([
    safe("recados", () => recentScrapsOf(userId), [] as HomeData["recentScraps"]),
    safe("solicitacoes", () => getPendingRequests(userId), [] as PendingRequestWithUser[]),
    safe("depoimentos", () => pendingTestimonialsOf(userId), null as number | null),
  ]);
  return { ...empty, recentScraps, pendingRequests, pendingTestimonials };
}
