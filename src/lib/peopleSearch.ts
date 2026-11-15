// ---------------------------------------------------------------------------
// Busca de pessoas — regras PURAS (sem rede), para ficarem testáveis.
//
// A consulta em si roda em services/authService.ts (searchProfilesByText) contra public.profiles.
// Aqui só se transforma o texto digitado num "plano" seguro:
//   - limpa o texto (espaços, caracteres de controle, "*", limite de tamanho);
//   - escapa os curingas do LIKE (% _ \) para que "100%" ou "a_b" sejam buscados como texto literal;
//   - separa o nome em palavras (todas precisam aparecer, em qualquer ordem);
//   - gera o padrão de username (sem "@", só caracteres válidos de username).
// Os padrões vão como VALOR de filtro (.ilike), nunca montados dentro de uma expressão .or(...),
// então vírgulas e parênteses digitados pelo usuário não conseguem alterar a consulta.
// ---------------------------------------------------------------------------

export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 60;
export const MAX_NAME_TERMS = 5;
/** Quantas pessoas aparecem na tela. */
export const SEARCH_LIMIT = 24;
/** Quantas linhas cada consulta busca antes de ordenar (margem para o ranqueamento). */
export const FETCH_LIMIT = 50;

export type SearchPlanStatus = "empty" | "too_short" | "ok";

export interface SearchPlan {
  status: SearchPlanStatus;
  /** Texto já limpo (o que a tela pode mostrar de volta). */
  cleaned: string;
  /** Um padrão ILIKE por palavra do nome (AND). */
  namePatterns: string[];
  /** Padrão ILIKE para username (null quando o texto não pode ser um username). */
  usernamePattern: string | null;
  /** Username exato candidato (para garantir que a correspondência exata sempre apareça). */
  usernameExact: string | null;
  /** Palavras limpas, em minúsculas (usadas no ranqueamento). */
  terms: string[];
}

/** Escapa os curingas do LIKE/ILIKE do Postgres (barra invertida é o escape padrão). */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (m) => `\\${m}`);
}

function cleanText(raw: string): string {
  return (
    raw
      .normalize("NFC")
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\*/g, " ") // "*" é curinga no PostgREST
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_QUERY_LENGTH)
      .trim()
  );
}

export function buildSearchPlan(raw: string | null | undefined): SearchPlan {
  const cleaned = cleanText(raw ?? "");
  const empty: SearchPlan = {
    status: "empty",
    cleaned,
    namePatterns: [],
    usernamePattern: null,
    usernameExact: null,
    terms: [],
  };
  if (!cleaned) return empty;

  // "@fulano" é uma forma natural de buscar por username.
  const withoutAt = cleaned.replace(/^@+/, "").trim();
  const lengthOfText = Array.from(withoutAt.replace(/\s/g, "")).length;
  if (lengthOfText < MIN_QUERY_LENGTH) return { ...empty, status: "too_short" };

  const terms = withoutAt
    .split(" ")
    .filter(Boolean)
    .slice(0, MAX_NAME_TERMS)
    .map((t) => t.toLowerCase());

  const usernameCandidate = withoutAt.toLowerCase();
  const looksLikeUsername = /^[a-z0-9._]+$/.test(usernameCandidate);

  return {
    status: "ok",
    cleaned,
    namePatterns: withoutAt
      .split(" ")
      .filter(Boolean)
      .slice(0, MAX_NAME_TERMS)
      .map((t) => `%${escapeLike(t)}%`),
    usernamePattern: looksLikeUsername ? `%${escapeLike(usernameCandidate)}%` : null,
    usernameExact: looksLikeUsername ? usernameCandidate : null,
    terms,
  };
}

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Menor = melhor: username exato, username começando com o texto, nome com palavra começando com o texto, demais. */
export function rankScore(person: { name: string; username: string }, plan: SearchPlan): number {
  const user = person.username.toLowerCase();
  const full = plan.terms.join(" ");
  const first = plan.terms[0] ?? "";
  if (plan.usernameExact && user === plan.usernameExact) return 0;
  if (plan.usernameExact && user.startsWith(plan.usernameExact)) return 1;
  const words = fold(person.name).split(/\s+/);
  if (fold(person.name).startsWith(fold(full)) || words.some((w) => w.startsWith(fold(first)))) return 2;
  return 3;
}

export function rankPeople<T extends { name: string; username: string }>(people: T[], plan: SearchPlan): T[] {
  return [...people].sort((a, b) => {
    const diff = rankScore(a, plan) - rankScore(b, plan);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }) || a.username.localeCompare(b.username);
  });
}
