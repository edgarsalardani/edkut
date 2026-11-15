// ---------------------------------------------------------------------------
// Comunidades (SOMENTE SERVIDOR): leitura real de public.communities, community_members,
// community_join_requests e community_categories (a RLS decide o que cada pessoa vê).
// Mutações ficam em lib/communities.ts (navegador, protegidas por RLS/funções do banco).
// Sem dados fictícios: falha => `error` (a tela mostra aviso, nunca uma lista inventada).
// ---------------------------------------------------------------------------
import { createClient } from "@/lib/supabase/server";
import { getProfileUsersByIds } from "@/services/authService";
import {
  COMMUNITY_COLUMNS,
  COMMUNITY_COLUMNS_NO_IMAGE,
  communityImageUrl,
  rowToCommunity,
  type CommunityRow,
} from "@/lib/communities";
import { isUuid } from "@/lib/uuid";
import type { CommunityInfo, CommunityMemberInfo, CommunityRole, JoinRequestInfo, User } from "@/types";

/** Teto de comunidades carregadas na lista (busca e filtros rodam no navegador sobre esta lista). */
export const COMMUNITY_LIST_LIMIT = 500;
/** Teto de participantes carregados por página de comunidade. */
export const COMMUNITY_MEMBERS_LIMIT = 200;

export interface CommunitiesData {
  communities: CommunityInfo[];
  categories: string[];
  /** Papel do usuário atual em cada comunidade (só as que ele participa). */
  myRoles: Record<string, CommunityRole>;
  /** Comunidades com solicitação PENDENTE do usuário atual. */
  myPendingIds: string[];
  error: boolean;
  /** As migrações 12/13 ainda não foram aplicadas (coluna inexistente). */
  migrationMissing: boolean;
}

const EMPTY: CommunitiesData = { communities: [], categories: [], myRoles: {}, myPendingIds: [], error: false, migrationMissing: false };

type Supabase = ReturnType<typeof createClient>;

function imageUrlFor(supabase: Supabase, row: CommunityRow): string | undefined {
  return communityImageUrl((bucket, path) => supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl, row.id, row.image_path);
}

export async function getCommunitiesData(userId: string): Promise<CommunitiesData> {
  if (!isUuid(userId)) return EMPTY;
  try {
    const supabase = createClient();
    const query = (cols: string) =>
      supabase
        .from("communities")
        .select(cols)
        .order("member_count", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(COMMUNITY_LIST_LIMIT);

    let res = await query(COMMUNITY_COLUMNS);
    // 42703 = coluna inexistente. Sem image_path => migração 13 pendente: segue sem imagens.
    if (res.error?.code === "42703" && !res.error.message.includes("join_policy")) res = await query(COMMUNITY_COLUMNS_NO_IMAGE);
    if (res.error) {
      if (res.error.code === "42703") return { ...EMPTY, migrationMissing: true };
      throw new Error(res.error.message);
    }
    const rows = (res.data as unknown as CommunityRow[] | null) ?? [];

    const [cats, mine, pending] = await Promise.all([
      supabase.from("community_categories").select("name, sort_order").order("sort_order"),
      supabase.from("community_members").select("community_id, role").eq("user_id", userId),
      supabase.from("community_join_requests").select("community_id").eq("user_id", userId).eq("status", "pending"),
    ]);
    if (cats.error) throw new Error(cats.error.message);
    if (mine.error) throw new Error(mine.error.message);
    // Se a tabela de solicitações não existir (migração 12 pendente) a leitura das comunidades já teria falhado acima.
    if (pending.error) throw new Error(pending.error.message);

    const myRoles: Record<string, CommunityRole> = {};
    for (const m of (mine.data as unknown as { community_id: string; role: CommunityRole }[]) ?? []) myRoles[m.community_id] = m.role;

    return {
      communities: rows.map((r) => rowToCommunity(r, imageUrlFor(supabase, r))),
      categories: ((cats.data as unknown as { name: string }[]) ?? []).map((c) => c.name),
      myRoles,
      myPendingIds: ((pending.data as unknown as { community_id: string }[]) ?? []).map((p) => p.community_id),
      error: false,
      migrationMissing: false,
    };
  } catch (e) {
    console.error("[comunidades]", e instanceof Error ? e.message : "erro desconhecido");
    return { ...EMPTY, error: true };
  }
}

export interface CommunityPageData {
  community: CommunityInfo | null;
  categories: string[];
  members: CommunityMemberInfo[];
  /** Perfis REAIS dos participantes, do criador e de quem solicitou. */
  people: User[];
  myRole?: CommunityRole;
  myPending: boolean;
  /** Solicitações pendentes (só preenchido para criador/moderador; a RLS esconde dos demais). */
  pendingRequests: JoinRequestInfo[];
  membersTruncated: boolean;
  error: boolean;
}

const EMPTY_PAGE: CommunityPageData = {
  community: null, categories: [], members: [], people: [], myPending: false, pendingRequests: [], membersTruncated: false, error: false,
};

export async function getCommunityPageData(communityId: string, userId: string): Promise<CommunityPageData> {
  if (!isUuid(communityId) || !isUuid(userId)) return EMPTY_PAGE;
  try {
    const supabase = createClient();
    let res = await supabase.from("communities").select(COMMUNITY_COLUMNS).eq("id", communityId).maybeSingle();
    if (res.error?.code === "42703" && !res.error.message.includes("join_policy")) {
      res = await supabase.from("communities").select(COMMUNITY_COLUMNS_NO_IMAGE).eq("id", communityId).maybeSingle();
    }
    if (res.error) throw new Error(res.error.message);
    const row = res.data as unknown as CommunityRow | null;
    if (!row) return EMPTY_PAGE;

    const [cats, mem, mine, pending] = await Promise.all([
      supabase.from("community_categories").select("name, sort_order").order("sort_order"),
      supabase
        .from("community_members")
        .select("user_id, role, joined_at")
        .eq("community_id", communityId)
        .order("joined_at", { ascending: true })
        .limit(COMMUNITY_MEMBERS_LIMIT + 1),
      supabase.from("community_members").select("role").eq("community_id", communityId).eq("user_id", userId).maybeSingle(),
      // A RLS devolve: as minhas (solicitante) e, se eu for criador/moderador, todas as da comunidade.
      supabase
        .from("community_join_requests")
        .select("id, community_id, user_id, created_at")
        .eq("community_id", communityId)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(200),
    ]);
    if (cats.error) throw new Error(cats.error.message);
    if (mem.error) throw new Error(mem.error.message);
    if (mine.error) throw new Error(mine.error.message);
    if (pending.error) throw new Error(pending.error.message);

    let members = ((mem.data as unknown as { user_id: string; role: CommunityRole; joined_at: string }[]) ?? []).map((m) => ({
      userId: m.user_id, role: m.role, joinedAt: m.joined_at,
    }));
    const membersTruncated = members.length > COMMUNITY_MEMBERS_LIMIT;
    members = members.slice(0, COMMUNITY_MEMBERS_LIMIT);

    const myRole = (mine.data as unknown as { role: CommunityRole } | null)?.role;
    const allPending = ((pending.data as unknown as { id: string; community_id: string; user_id: string; created_at: string }[]) ?? []).map((r) => ({
      id: r.id, communityId: r.community_id, userId: r.user_id, createdAt: r.created_at,
    }));
    const myPending = allPending.some((r) => r.userId === userId);
    const isMod = myRole === "moderator";
    const pendingRequests = isMod ? allPending : [];

    const people = await getProfileUsersByIds([
      ...(row.creator_id ? [row.creator_id] : []),
      ...members.map((m) => m.userId),
      ...pendingRequests.map((r) => r.userId),
    ]);

    return {
      community: rowToCommunity(row, imageUrlFor(supabase, row)),
      categories: ((cats.data as unknown as { name: string }[]) ?? []).map((c) => c.name),
      members, people, myRole, myPending, pendingRequests, membersTruncated, error: false,
    };
  } catch (e) {
    console.error("[comunidade]", e instanceof Error ? e.message : "erro desconhecido");
    return { ...EMPTY_PAGE, error: true };
  }
}
