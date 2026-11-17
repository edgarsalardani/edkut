// ---------------------------------------------------------------------------
// Perfil clássico (SOMENTE SERVIDOR): status/dados pessoais, contadores, fotos, vídeos, fãs e comunidades de um perfil.
// Tudo vem do Supabase (a RLS decide); nada é fictício. Se a migração 14 ainda não foi aplicada, o perfil continua
// funcionando (sem os recursos novos) e a página mostra um aviso.
// ---------------------------------------------------------------------------
import { createClient } from "@/lib/supabase/server";
import { communityImageUrl } from "@/lib/communities";
import { photoPublicUrl } from "@/lib/profileClassic";
import { isUuid } from "@/lib/uuid";
import type { ProfileCommunity, ProfileExtras, ProfilePhoto, ProfileVideo, RelationshipKey } from "@/types";

export const PHOTOS_SHOWN = 60;
export const VIDEOS_SHOWN = 30;

export interface ProfileCounts {
  /** null = não foi possível contar (a tela mostra "–"). */
  scraps: number | null;
  photos: number | null;
  videos: number | null;
  fans: number | null;
  communities: number | null;
}

export interface ProfileClassicData {
  extras: ProfileExtras;
  counts: ProfileCounts;
  photos: ProfilePhoto[];
  videos: ProfileVideo[];
  iAmFan: boolean;
  communities: ProfileCommunity[];
  /** A migração 14 ainda não foi aplicada (colunas/tabelas novas inexistentes). */
  migrationMissing: boolean;
  /** Alguma consulta falhou por outro motivo. */
  error: boolean;
}

export const EMPTY_CLASSIC: ProfileClassicData = {
  extras: {},
  counts: { scraps: null, photos: null, videos: null, fans: null, communities: null },
  photos: [],
  videos: [],
  iAmFan: false,
  communities: [],
  migrationMissing: false,
  error: false,
};

type Supabase = ReturnType<typeof createClient>;
interface DbError { code?: string; message?: string }

const MISSING_CODES = new Set(["42703", "42P01", "PGRST204", "PGRST205"]);
const isMissing = (e: DbError | null | undefined) => !!e && (MISSING_CODES.has(e.code ?? "") || /does not exist|schema cache/i.test(e.message ?? ""));

const publicUrl = (supabase: Supabase) => (bucket: string, path: string) => supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;

async function count(q: PromiseLike<{ count: number | null; error: DbError | null }>, flags: { missing: boolean; error: boolean }): Promise<number | null> {
  const r = await q;
  if (r.error) {
    if (isMissing(r.error)) flags.missing = true;
    else flags.error = true;
    return null;
  }
  return r.count ?? 0;
}

interface ExtrasRow { status_phrase: string | null; relationship: RelationshipKey | null; birthday: string | null; hobbies: string | null }

function rowToExtras(row: ExtrasRow | null): ProfileExtras {
  if (!row) return {};
  return {
    statusPhrase: row.status_phrase ?? undefined,
    relationship: row.relationship ?? undefined,
    birthday: row.birthday ?? undefined,
    hobbies: row.hobbies ?? undefined,
  };
}

/** Dados extras do PRÓPRIO perfil para a página de edição. */
export async function getProfileExtras(userId: string): Promise<{ extras: ProfileExtras; migrationMissing: boolean; error: boolean }> {
  if (!isUuid(userId)) return { extras: {}, migrationMissing: false, error: false };
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("profiles").select("status_phrase, relationship, birthday, hobbies").eq("id", userId).maybeSingle();
    if (error) return { extras: {}, migrationMissing: isMissing(error), error: !isMissing(error) };
    return { extras: rowToExtras(data as unknown as ExtrasRow | null), migrationMissing: false, error: false };
  } catch (e) {
    console.error("[perfil-extras]", e instanceof Error ? e.message : "erro desconhecido");
    return { extras: {}, migrationMissing: false, error: true };
  }
}

/** Comunidades de que a pessoa participa (mais recentes primeiro), com o total real. */
export async function getProfileCommunities(profileId: string, limit: number): Promise<{ items: ProfileCommunity[]; total: number | null; error: boolean }> {
  if (!isUuid(profileId)) return { items: [], total: 0, error: false };
  try {
    const supabase = createClient();
    const mem = await supabase
      .from("community_members")
      .select("community_id", { count: "exact" })
      .eq("user_id", profileId)
      .order("joined_at", { ascending: false })
      .limit(limit);
    if (mem.error) throw new Error(mem.error.message);
    const ids = ((mem.data as unknown as { community_id: string }[]) ?? []).map((m) => m.community_id);
    const total = mem.count ?? ids.length;
    if (ids.length === 0) return { items: [], total, error: false };

    const cols = "id, name, emoji, color, member_count";
    let res = await supabase.from("communities").select(`${cols}, image_path`).in("id", ids);
    if (res.error?.code === "42703") res = await supabase.from("communities").select(cols).in("id", ids); // migração 13 pendente
    if (res.error) throw new Error(res.error.message);
    const byId = new Map<string, ProfileCommunity>();
    for (const r of (res.data as unknown as { id: string; name: string; emoji: string; color: string; member_count: number; image_path?: string | null }[]) ?? []) {
      byId.set(r.id, {
        id: r.id,
        name: r.name,
        emoji: r.emoji,
        color: r.color,
        memberCount: r.member_count,
        imageUrl: communityImageUrl((b, p) => publicUrl(supabase)(b, p), r.id, r.image_path),
      });
    }
    return { items: ids.map((id) => byId.get(id)).filter((c): c is ProfileCommunity => Boolean(c)), total, error: false };
  } catch (e) {
    console.error("[perfil-comunidades]", e instanceof Error ? e.message : "erro desconhecido");
    return { items: [], total: null, error: true };
  }
}

/**
 * Resumo LEVE do perfil (para a Home): status, contadores e comunidades — sem carregar fotos/vídeos.
 * Usa as mesmas consultas/contagens do perfil clássico (nenhuma estrutura paralela).
 */
export async function getProfileSummary(profileId: string): Promise<Omit<ProfileClassicData, "photos" | "videos" | "iAmFan">> {
  const base = { extras: EMPTY_CLASSIC.extras, counts: EMPTY_CLASSIC.counts, communities: [] as ProfileCommunity[], migrationMissing: false, error: false };
  if (!isUuid(profileId)) return base;
  const flags = { missing: false, error: false };
  try {
    const supabase = createClient();
    const head = (table: string) => supabase.from(table).select("id", { count: "exact", head: true });
    const [extrasRes, scraps, photos, videos, fans, communities] = await Promise.all([
      supabase.from("profiles").select("status_phrase, relationship, birthday, hobbies").eq("id", profileId).maybeSingle(),
      count(head("scraps").eq("profile_owner_id", profileId).is("parent_id", null), flags),
      count(head("profile_photos").eq("owner_id", profileId), flags),
      count(head("profile_videos").eq("owner_id", profileId), flags),
      count(supabase.from("profile_fans").select("fan_id", { count: "exact", head: true }).eq("profile_id", profileId), flags),
      getProfileCommunities(profileId, 9),
    ]);
    if (extrasRes.error) {
      if (isMissing(extrasRes.error)) flags.missing = true;
      else flags.error = true;
    }
    return {
      extras: rowToExtras(extrasRes.error ? null : (extrasRes.data as unknown as ExtrasRow | null)),
      counts: { scraps, photos, videos, fans, communities: communities.total },
      communities: communities.items,
      migrationMissing: flags.missing,
      error: flags.error || communities.error,
    };
  } catch (e) {
    console.error("[perfil-resumo]", e instanceof Error ? e.message : "erro desconhecido");
    return { ...base, error: true };
  }
}

export async function getProfileClassicData(profileId: string, viewerId: string): Promise<ProfileClassicData> {
  if (!isUuid(profileId) || !isUuid(viewerId)) return EMPTY_CLASSIC;
  const flags = { missing: false, error: false };
  try {
    const supabase = createClient();
    const head = (table: string) => supabase.from(table).select("id", { count: "exact", head: true });
    const isSelf = profileId === viewerId;

    const [extrasRes, scraps, photosCount, videosCount, fans, photosRes, videosRes, fanRes, communities] = await Promise.all([
      supabase.from("profiles").select("status_phrase, relationship, birthday, hobbies").eq("id", profileId).maybeSingle(),
      count(head("scraps").eq("profile_owner_id", profileId).is("parent_id", null), flags),
      count(head("profile_photos").eq("owner_id", profileId), flags),
      count(head("profile_videos").eq("owner_id", profileId), flags),
      count(supabase.from("profile_fans").select("fan_id", { count: "exact", head: true }).eq("profile_id", profileId), flags),
      supabase.from("profile_photos").select("id, owner_id, path, caption, created_at").eq("owner_id", profileId).order("created_at", { ascending: false }).limit(PHOTOS_SHOWN),
      supabase.from("profile_videos").select("id, owner_id, youtube_id, title, description, created_at").eq("owner_id", profileId).order("created_at", { ascending: false }).limit(VIDEOS_SHOWN),
      isSelf
        ? Promise.resolve({ data: null, error: null as DbError | null })
        : supabase.from("profile_fans").select("fan_id").eq("fan_id", viewerId).eq("profile_id", profileId).maybeSingle(),
      getProfileCommunities(profileId, 9),
    ]);

    for (const r of [extrasRes, photosRes, videosRes, fanRes]) {
      if (r.error) {
        if (isMissing(r.error)) flags.missing = true;
        else flags.error = true;
      }
    }

    const photos: ProfilePhoto[] = [];
    for (const r of (photosRes.data as unknown as { id: string; owner_id: string; path: string; caption: string; created_at: string }[] | null) ?? []) {
      const url = photoPublicUrl(publicUrl(supabase), r.owner_id, r.path);
      if (url) photos.push({ id: r.id, ownerId: r.owner_id, path: r.path, url, caption: r.caption, createdAt: r.created_at });
    }
    const videos: ProfileVideo[] = ((videosRes.data as unknown as { id: string; owner_id: string; youtube_id: string; title: string; description: string; created_at: string }[] | null) ?? []).map((r) => ({
      id: r.id, ownerId: r.owner_id, youtubeId: r.youtube_id, title: r.title, description: r.description, createdAt: r.created_at,
    }));

    return {
      extras: rowToExtras(extrasRes.error ? null : (extrasRes.data as unknown as ExtrasRow | null)),
      counts: { scraps, photos: photosCount, videos: videosCount, fans, communities: communities.total },
      photos,
      videos,
      iAmFan: Boolean(fanRes.data),
      communities: communities.items,
      migrationMissing: flags.missing,
      error: flags.error || communities.error,
    };
  } catch (e) {
    console.error("[perfil-classico]", e instanceof Error ? e.message : "erro desconhecido");
    return { ...EMPTY_CLASSIC, error: true };
  }
}
