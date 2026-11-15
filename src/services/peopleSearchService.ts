// ---------------------------------------------------------------------------
// Busca de pessoas (SOMENTE SERVIDOR): perfis reais de public.profiles + a relação de amizade de cada um com o
// usuário logado. Não há fallback para usuários fictícios: falha => status "error"; sem resultado => lista vazia.
// ---------------------------------------------------------------------------
import { searchProfilesByText } from "@/services/authService";
import { getFriendshipStates, type FriendshipState } from "@/services/socialService";
import { FETCH_LIMIT, SEARCH_LIMIT, buildSearchPlan, rankPeople } from "@/lib/peopleSearch";
import type { User } from "@/types";

export interface PersonResult {
  user: User;
  friendship: FriendshipState;
}

export type PeopleSearchStatus = "empty" | "too_short" | "ok" | "error";

export interface PeopleSearchOutcome {
  status: PeopleSearchStatus;
  /** Texto limpo usado na busca. */
  query: string;
  people: PersonResult[];
  /** Há mais resultados do que os exibidos (pedir ao usuário para refinar). */
  truncated: boolean;
}

export async function searchPeople(rawQuery: string, currentUserId: string): Promise<PeopleSearchOutcome> {
  const plan = buildSearchPlan(rawQuery);
  if (plan.status !== "ok") return { status: plan.status, query: plan.cleaned, people: [], truncated: false };

  try {
    const found = await searchProfilesByText({
      namePatterns: plan.namePatterns,
      usernamePattern: plan.usernamePattern,
      usernameExact: plan.usernameExact,
      excludeId: currentUserId,
      limit: FETCH_LIMIT,
    });
    const ranked = rankPeople(found, plan);
    const shown = ranked.slice(0, SEARCH_LIMIT);
    const states = await getFriendshipStates(
      currentUserId,
      shown.map((u) => u.id)
    );
    return {
      status: "ok",
      query: plan.cleaned,
      people: shown.map((user) => ({ user, friendship: states.get(user.id) ?? { status: "none" } })),
      truncated: ranked.length > SEARCH_LIMIT,
    };
  } catch (e) {
    console.error("[busca de pessoas]", e instanceof Error ? e.message : "erro desconhecido");
    return { status: "error", query: plan.cleaned, people: [], truncated: false };
  }
}
