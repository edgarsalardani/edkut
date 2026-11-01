// ---------------------------------------------------------------------------
// Serviço de autenticação/perfil (SOMENTE SERVIDOR).
//
// Fica separado de userService.ts de propósito: userService é importado (via
// friendService) por Client Components, e este arquivo usa next/headers, que não
// pode ir para o bundle do navegador.
//
// Etapa 2: o usuário logado e perfis com id UUID vêm do Supabase (tabela profiles).
// Os demais dados (amigos, comunidades, posts, scraps...) seguem mockados.
// ---------------------------------------------------------------------------
import * as React from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getUserById as getMockUserById } from "@/services/userService";
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
  created_at: string;
}

interface ScoresRow {
  tech_base: number | null;
  parceiro_base: number | null;
  geek_base: number | null;
}

const PROFILE_COLUMNS =
  "id, username, name, user_type, headline, bio, institution, course_or_area, location, interests, avatar_emoji, avatar_color, created_at";

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
 * Campos que ainda não têm origem real (amigos, comunidades) ficam vazios até as
 * próximas etapas; TECH/PARCEIRO/GEEK usam o valor-base (D4 pendente) e 0 se não houver.
 */
function toUser(row: ProfileRow, scores: ScoresRow | null, online: boolean): User {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    avatarEmoji: row.avatar_emoji,
    avatarColor: row.avatar_color,
    userType: row.user_type,
    headline: row.headline,
    bio: row.bio,
    institution: row.institution ?? undefined,
    courseOrArea: row.course_or_area ?? undefined,
    location: row.location ?? undefined,
    interests: row.interests ?? [],
    friendIds: [],
    communityIds: [],
    techProfile: {
      tech: scores?.tech_base ?? 0,
      parceiro: scores?.parceiro_base ?? 0,
      geek: scores?.geek_base ?? 0,
    },
    joinedAt: row.created_at,
    online,
  };
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

  // Indicadores TECH/PARCEIRO/GEEK: linha opcional (só existe após seed/votos). Falha aqui não deve derrubar a página.
  const { data: scoresData } = await supabase
    .from("profile_scores")
    .select("tech_base, parceiro_base, geek_base")
    .eq("profile_id", id)
    .maybeSingle();
  const scores = (scoresData as unknown as ScoresRow | null) ?? null;

  return toUser(row, scores, online);
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
 * Perfil por id para a página /profile/[id]:
 *  - id em formato UUID  => usuário real (tabela profiles);
 *  - qualquer outro id   => usuário fictício dos mocks (u1, u2, ...).
 */
export async function getProfileUserById(id: string): Promise<User | undefined> {
  if (!isUuid(id)) {
    return getMockUserById(id);
  }
  const supabase = createClient();
  return fetchProfileUser(supabase, id, false);
}
