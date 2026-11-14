// ---------------------------------------------------------------------------
// Avaliações sociais NERD · PARCEIRO · TECH no navegador (Supabase, migração 9).
//   - rate_friend(): grava OU substitui a avaliação (SECURITY INVOKER: a RLS do banco decide);
//   - profile_social_scores(): média consolidada (somente leitura);
//   - o app NUNCA calcula nem grava a média.
// ---------------------------------------------------------------------------
import { createClient } from "@/lib/supabase/client";
import type { TechProfileScore } from "@/types";

export interface ScoresSnapshot {
  scores: TechProfileScore;
  ratingsCount: number;
}

export interface MyRating {
  nerd: number;
  parceiro: number;
  tech: number;
  /** false: o voto é de uma amizade desfeita/refeita e NÃO está sendo contado até ser salvo de novo. */
  isCurrent: boolean;
}

export interface RateResult {
  ok: boolean;
  error?: string;
}

interface ScoresRpcRow {
  nerd: number;
  parceiro: number;
  tech: number;
  ratings_count: number;
}

function friendlyRatingError(error: { message?: string; code?: string }): string {
  const message = (error.message ?? "").toLowerCase();
  if (error.code === "42501" || message.includes("only friends")) {
    return "Só amigos com amizade aceita podem avaliar.";
  }
  if (error.code === "22023" || message.includes("yourself")) return "Você não pode avaliar a si mesmo.";
  if (error.code === "22003" || error.code === "23514") return "Os valores precisam estar entre 0 e 100.";
  if (error.code === "28000") return "Sua sessão expirou. Entre novamente.";
  if (message.includes("could not find the function") || message.includes("schema cache")) {
    return "O recurso de avaliações ainda não foi instalado no Supabase (migração 9).";
  }
  if (message.includes("failed to fetch") || message.includes("network")) {
    return "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.";
  }
  return "Não foi possível salvar a avaliação. Tente novamente.";
}

export function validateRatingValue(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 100;
}

export async function rateFriend(ratedId: string, values: { nerd: number; parceiro: number; tech: number }): Promise<RateResult> {
  if (![values.nerd, values.parceiro, values.tech].every(validateRatingValue)) {
    return { ok: false, error: "Os valores precisam ser números inteiros entre 0 e 100." };
  }
  try {
    const supabase = createClient();
    const { error } = await supabase.rpc("rate_friend", {
      p_rated: ratedId,
      p_nerd: values.nerd,
      p_parceiro: values.parceiro,
      p_tech: values.tech,
    });
    if (error) return { ok: false, error: friendlyRatingError(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyRatingError(e as { message?: string }) };
  }
}

/** Percentuais consolidados atuais de um perfil (null se a consulta falhar). */
export async function fetchProfileScores(profileId: string): Promise<ScoresSnapshot | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("profile_social_scores", { p_profile: profileId });
    const row = ((data as unknown as ScoresRpcRow[] | null) ?? [])[0];
    if (error || !row) return null;
    return { scores: { nerd: row.nerd, parceiro: row.parceiro, tech: row.tech }, ratingsCount: row.ratings_count };
  } catch {
    return null;
  }
}
