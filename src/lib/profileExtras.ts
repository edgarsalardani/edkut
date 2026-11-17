// ---------------------------------------------------------------------------
// Status, dados pessoais e "sou fã" — gravação no NAVEGADOR (Supabase). Quem garante "só o dono edita" é o banco
// (RLS profiles_update_own + grant por coluna da migração 14); aqui só filtramos pelo próprio id e tratamos erros.
// ---------------------------------------------------------------------------
import { createClient } from "@/lib/supabase/client";
import { validateExtras, validateStatus, type ExtrasInput } from "@/lib/profileClassic";
import type { ProfileExtras, RelationshipKey } from "@/types";

export interface ExtrasResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

export function friendlyProfileError(error: { message?: string; code?: string }): string {
  const message = (error.message ?? "").toLowerCase();
  if (error.code === "42703" || (message.includes("column") && message.includes("does not exist")) || message.includes("schema cache")) {
    return "Este recurso precisa da migração 14 no Supabase. Aplique-a e atualize a página.";
  }
  if (error.code === "42501" || message.includes("row-level security") || message.includes("permission denied")) return "Você não tem permissão para esta ação.";
  if (error.code === "23514") return "Algum valor passou do limite permitido. Confira os campos.";
  if (error.code === "28000" || message.includes("jwt")) return "Sua sessão expirou. Entre novamente.";
  if (message.includes("failed to fetch") || message.includes("network")) return "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.";
  return "Não foi possível salvar. Tente novamente.";
}

function fail(e: unknown): ExtrasResult<never> {
  return { ok: false, error: friendlyProfileError(e as { message?: string; code?: string }) };
}

/** Grava (ou remove, se vazio) a frase de status do PRÓPRIO perfil. */
export async function saveStatus(userId: string, input: string): Promise<ExtrasResult<{ statusPhrase?: string }>> {
  const v = validateStatus(input);
  if (!v.ok) return { ok: false, error: v.error };
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("profiles").update({ status_phrase: v.value }).eq("id", userId).select("id");
    if (error) return { ok: false, error: friendlyProfileError(error) };
    if (!data || (data as unknown[]).length === 0) return { ok: false, error: "Somente o dono do perfil pode editar o status." };
    return { ok: true, data: { statusPhrase: v.value ?? undefined } };
  } catch (e) {
    return fail(e);
  }
}

/** Grava relacionamento, aniversário e hobbies do PRÓPRIO perfil. */
export async function saveExtras(userId: string, input: ExtrasInput): Promise<ExtrasResult<ProfileExtras>> {
  const v = validateExtras(input);
  if (!v.ok || !v.clean) return { ok: false, error: v.error };
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .update({ relationship: v.clean.relationship, birthday: v.clean.birthday, hobbies: v.clean.hobbies })
      .eq("id", userId)
      .select("id");
    if (error) return { ok: false, error: friendlyProfileError(error) };
    if (!data || (data as unknown[]).length === 0) return { ok: false, error: "Somente o dono do perfil pode editar estes dados." };
    return {
      ok: true,
      data: {
        relationship: (v.clean.relationship ?? undefined) as RelationshipKey | undefined,
        birthday: v.clean.birthday ?? undefined,
        hobbies: v.clean.hobbies ?? undefined,
      },
    };
  } catch (e) {
    return fail(e);
  }
}

/** "Sou fã": liga/desliga. Repetir o mesmo estado é tratado como sucesso (idempotente). */
export async function setFan(viewerId: string, profileId: string, on: boolean): Promise<ExtrasResult> {
  if (viewerId === profileId) return { ok: false, error: "Você não pode ser fã de si mesmo." };
  try {
    const supabase = createClient();
    if (on) {
      const { error } = await supabase.from("profile_fans").insert({ profile_id: profileId });
      if (error && error.code !== "23505") return { ok: false, error: friendlyProfileError(error) };
    } else {
      const { error } = await supabase.from("profile_fans").delete().eq("fan_id", viewerId).eq("profile_id", profileId);
      if (error) return { ok: false, error: friendlyProfileError(error) };
    }
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
