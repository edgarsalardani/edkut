// ---------------------------------------------------------------------------
// Serviço de autenticação/perfil (SOMENTE SERVIDOR).
//
// Fica separado de userService.ts de propósito: userService é importado (via
// friendService) por Client Components, e este arquivo usa next/headers, que não
// pode ir para o bundle do navegador.
//
// Etapa 2: o usuário logado e perfis com id UUID vêm do Supabase (tabela profiles).
// Amizades, avaliações, scraps e depoimentos também são reais; posts e comunidades ainda não foram integrados
// (a interface mostra estados vazios, nunca dados fictícios).
// ---------------------------------------------------------------------------
import * as React from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { User, UserType } from "@/types";

/** Linha da tabela public.profiles (colunas lidas pelo app). */
interface ProfileRow {
  id: string;
  username: string;
  name: string;
  user_type: UserType;
  headline: string;
  bio: string;
  institution: string | null;
  course_or_area: string | null;
  location: string | null;
  interests: string[];
  avatar_emoji: string;
  avatar_color: string;
  avatar_path: string | null;
  created_at: string;
}

/** Linha devolvida por public.profile_social_scores() (migração 9): média das avaliações VÁLIDAS dos amigos. */
interface SocialScoresRow {
  nerd: number;
  parceiro: number;
  tech: number;
  ratings_count: number;
}

/** Extras de um perfil real: amigos, indicadores, foto e presença. */
interface UserExtras {
  online: boolean;
  avatarUrl?: string;
  friendIds?: string[];
  scores?: SocialScoresRow | null;
}

const PROFILE_COLUMNS =
  "id, username, name, user_type, headline, bio, institution, course_or_area, location, interests, avatar_emoji, avatar_color, avatar_path, created_at";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Memoiza por requisição (React.cache), para AppShell e a página não repetirem
 * getUser()/consulta de perfil na mesma navegação. `cache` existe no React usado
 * pelo App Router do Next 14, mas os tipos do @types/react 18 não o expõem — por isso o cast.
 */
function memoPerRequest<A extends unknown[], R>(fn: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  const reactCache = (React as unknown as { cache?: <T>(f: T) => T }).cache;
  return reactCache ? reactCache(fn) : fn;
}

/**
 * Converte uma linha de `profiles` no tipo `User` que o frontend já usa.
 * friendIds vem de public.friendships (amizades reais). NERD/PARCEIRO/TECH vêm das avaliações dos amigos
 * (migração 9; sem avaliações => 0 e ratingsCount 0). A coluna legada profile_scores.geek_base não é mais lida.
 */
function toUser(row: ProfileRow, extras: UserExtras): User {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    avatarEmoji: row.avatar_emoji,
    avatarColor: row.avatar_color,
    avatarUrl: extras.avatarUrl,
    userType: row.user_type,
    headline: row.headline,
    bio: row.bio,
    institution: row.institution ?? undefined,
    courseOrArea: row.course_or_area ?? undefined,
    location: row.location ?? undefined,
    interests: row.interests ?? [],
    friendIds: extras.friendIds ?? [],
    communityIds: [],
    techProfile: {
      nerd: extras.scores?.nerd ?? 0,
      parceiro: extras.scores?.parceiro ?? 0,
      tech: extras.scores?.tech ?? 0,
    },
    ratingsCount: extras.scores?.ratings_count ?? 0,
    joinedAt: row.created_at,
    // Não existe presença real (online/offline) no banco: nunca mostramos o indicador verde.
    online: false,
  };
}

/**
 * A foto fica no bucket público `avatars`; o perfil guarda só o CAMINHO (avatar_path). A URL é montada aqui
 * com o domínio do PRÓPRIO projeto (getPublicUrl só concatena strings, sem rede) — nunca vem do banco.
 * Defesa extra: só aceita caminhos dentro da pasta do dono do perfil (o banco já garante isso via CHECK).
 */
function buildAvatarUrl(supabase: SupabaseClient, row: ProfileRow): string | undefined {
  const path = row.avatar_path;
  if (!path || !path.startsWith(`${row.id}/`)) return undefined;
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}

async function fetchProfileUser(
  supabase: SupabaseClient,
  id: string,
  online: boolean
): Promise<User | undefined> {
  const { data, error } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", id).maybeSingle();

  if (error) {
    throw new Error(`Não foi possível carregar o perfil (${error.message}).`);
  }
  const row = data as unknown as ProfileRow | null;
  if (!row) return undefined;

  // Amigos reais e indicadores consolidados. Falha numa destas consultas (ex.: migração 9 ainda não aplicada)
  // não derruba a página: cai em "sem amigos / 0%".
  const [scoresRes, friendsRes] = await Promise.all([
    supabase.rpc("profile_social_scores", { p_profile: id }),
    supabase.rpc("friend_ids_of", { p_user: id }),
  ]);
  const scoreRows = (scoresRes.data as unknown as SocialScoresRow[] | null) ?? [];
  const friendIds = normalizeIds(friendsRes.data);

  return toUser(row, {
    online,
    avatarUrl: buildAvatarUrl(supabase, row),
    friendIds,
    scores: scoreRows[0] ?? null,
  });
}

/** `friend_ids_of` devolve `setof uuid`: aceita tanto ["id", ...] quanto [{ friend_ids_of: "id" }, ...]. */
function normalizeIds(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => (typeof item === "string" ? item : item && typeof item === "object" ? String(Object.values(item)[0] ?? "") : ""))
    .filter((id) => isUuid(id));
}

/**
 * Perfis REAIS por id, em lote (listas de amigos, solicitações). Versão leve: sem indicadores nem lista de amigos
 * de cada um. IDs que não existirem são ignorados; a ordem pedida é preservada.
 */
export async function getProfileUsersByIds(ids: string[]): Promise<User[]> {
  const valid = Array.from(new Set(ids.filter(isUuid)));
  if (valid.length === 0) return [];
  const supabase = createClient();
  const { data, error } = await supabase.from("profiles").select(PROFILE_COLUMNS).in("id", valid);
  if (error) throw new Error(`Não foi possível carregar os perfis (${error.message}).`);
  const byId = new Map<string, User>();
  for (const row of (data as unknown as ProfileRow[]) ?? []) {
    byId.set(row.id, toUser(row, { online: false, avatarUrl: buildAvatarUrl(supabase, row) }));
  }
  return valid.map((id) => byId.get(id)).filter((u): u is User => Boolean(u));
}

/** Colunas lidas pela busca de pessoas: só o que a lista exibe (nome, username, foto, tipo, frase). */
const SEARCH_COLUMNS =
  "id, username, name, user_type, headline, institution, avatar_emoji, avatar_color, avatar_path, created_at";

type SearchRow = Pick<
  ProfileRow,
  "id" | "username" | "name" | "user_type" | "headline" | "institution" | "avatar_emoji" | "avatar_color" | "avatar_path" | "created_at"
>;

/**
 * Busca de pessoas REAIS em public.profiles (a RLS permite leitura a usuários autenticados; `anon` não lê nada).
 * Combina: (a) nome contendo TODAS as palavras, (b) username contendo o texto, (c) username exato.
 * Os padrões chegam já escapados (lib/peopleSearch.ts) e são passados como valor de filtro, nunca dentro de .or().
 * O próprio usuário logado é excluído. Falha de consulta => lança erro (a página mostra mensagem, não "nada encontrado").
 */
export async function searchProfilesByText(opts: {
  namePatterns: string[];
  usernamePattern: string | null;
  usernameExact: string | null;
  excludeId: string;
  limit: number;
}): Promise<User[]> {
  const supabase = createClient();

  let nameQuery = supabase.from("profiles").select(SEARCH_COLUMNS).neq("id", opts.excludeId);
  for (const pattern of opts.namePatterns) nameQuery = nameQuery.ilike("name", pattern);
  const queries: PromiseLike<{ data: unknown; error: { message: string } | null }>[] = [
    nameQuery.order("name").limit(opts.limit),
  ];
  if (opts.usernamePattern) {
    queries.push(
      supabase
        .from("profiles")
        .select(SEARCH_COLUMNS)
        .neq("id", opts.excludeId)
        .ilike("username", opts.usernamePattern)
        .order("username")
        .limit(opts.limit)
    );
  }
  if (opts.usernameExact) {
    queries.push(
      supabase.from("profiles").select(SEARCH_COLUMNS).neq("id", opts.excludeId).eq("username", opts.usernameExact).limit(1)
    );
  }

  const results = await Promise.all(queries);
  const byId = new Map<string, User>();
  for (const result of results) {
    if (result.error) throw new Error(`Não foi possível buscar pessoas (${result.error.message}).`);
    for (const r of (result.data as SearchRow[] | null) ?? []) {
      if (byId.has(r.id)) continue;
      const row: ProfileRow = { ...r, bio: "", course_or_area: null, location: null, interests: [] };
      byId.set(r.id, toUser(row, { online: false, avatarUrl: buildAvatarUrl(supabase, row) }));
    }
  }
  return Array.from(byId.values());
}

/**
 * Usuário autenticado + seu perfil. Sem sessão válida, redireciona para /login
 * (o middleware já barra antes; isto é a segunda camada de defesa).
 */
export const getCurrentUser = memoPerRequest(async (): Promise<User> => {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const profile = await fetchProfileUser(supabase, user.id, true);
  if (!profile) {
    throw new Error(
      "Seu usuário existe no Supabase Auth, mas não há linha em public.profiles. " +
        "Confira se o trigger on_auth_user_created foi criado (migração 0002)."
    );
  }
  return profile;
});

/**
 * Perfil por id para a página /profile/[id]. Só existem perfis REAIS (id UUID, tabela profiles);
 * qualquer outro id (inclusive os antigos "u1", "u2"...) => undefined (a página mostra "não encontrado").
 */
export async function getProfileUserById(id: string): Promise<User | undefined> {
  if (!isUuid(id)) {
    return undefined;
  }
  const supabase = createClient();
  return fetchProfileUser(supabase, id, false);
}
