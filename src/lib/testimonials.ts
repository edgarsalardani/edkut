// ---------------------------------------------------------------------------
// Depoimentos REAIS no navegador (Supabase, tabela public.testimonials). Regras (todas no banco, migração 6):
//   - nasce SEMPRE `pending` (o cliente nem tem privilégio de informar `status` no INSERT);
//   - só o DESTINATÁRIO muda o status, e só para approved/rejected;
//   - só `approved` é público; o autor e o destinatário enxergam os não aprovados;
//   - no máximo 1 pendente por par (autor, destinatário); depoimento sobre si mesmo é impossível;
//   - autor e destinatário podem apagar.
// ---------------------------------------------------------------------------
import { createClient } from "@/lib/supabase/client";
import type { Testimonial, TestimonialStatus } from "@/types";

export const TESTIMONIAL_MAX_LENGTH = 1000;

export interface TestimonialResult {
  ok: boolean;
  error?: string;
  testimonial?: Testimonial;
}

function charLength(value: string): number {
  return Array.from(value).length;
}

export function validateTestimonialBody(text: string): string | null {
  const body = text.trim();
  if (!body) return "Escreva o depoimento antes de enviar.";
  if (charLength(body) > TESTIMONIAL_MAX_LENGTH) return `O depoimento pode ter no máximo ${TESTIMONIAL_MAX_LENGTH} caracteres.`;
  return null;
}

export function friendlyTestimonialError(error: { message?: string; code?: string }): string {
  const message = (error.message ?? "").toLowerCase();
  if (error.code === "23505" || message.includes("testimonials_one_pending_per_pair")) {
    return "Você já enviou um depoimento para esta pessoa que ainda aguarda aprovação. Espere a resposta para enviar outro.";
  }
  if (error.code === "23514" && message.includes("not_self")) return "Você não pode escrever um depoimento sobre si mesmo.";
  if (error.code === "23514") return `O depoimento deve ter entre 1 e ${TESTIMONIAL_MAX_LENGTH} caracteres.`;
  if (error.code === "42501" || message.includes("row-level security")) return "Você não tem permissão para esta ação.";
  if (error.code === "28000" || message.includes("jwt")) return "Sua sessão expirou. Entre novamente.";
  if (message.includes("failed to fetch") || message.includes("network")) {
    return "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.";
  }
  return "Não foi possível concluir a ação. Tente novamente.";
}

interface TestimonialRow {
  id: string;
  profile_owner_id: string;
  author_id: string;
  body: string;
  status: TestimonialStatus;
  created_at: string;
}

export const TESTIMONIAL_COLUMNS = "id, profile_owner_id, author_id, body, status, created_at";

export function rowToTestimonial(row: TestimonialRow): Testimonial {
  return {
    id: row.id,
    profileOwnerId: row.profile_owner_id,
    authorId: row.author_id,
    message: row.body,
    createdAt: row.created_at,
    approved: row.status === "approved",
    status: row.status,
  };
}

export async function sendTestimonial(profileOwnerId: string, text: string): Promise<TestimonialResult> {
  const invalid = validateTestimonialBody(text);
  if (invalid) return { ok: false, error: invalid };
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("testimonials")
      .insert({ profile_owner_id: profileOwnerId, body: text.trim() })
      .select(TESTIMONIAL_COLUMNS)
      .single();
    if (error) return { ok: false, error: friendlyTestimonialError(error) };
    return { ok: true, testimonial: rowToTestimonial(data as unknown as TestimonialRow) };
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Variáveis do Supabase ausentes")) return { ok: false, error: e.message };
    return { ok: false, error: friendlyTestimonialError(e as { message?: string }) };
  }
}

/** Só o destinatário consegue (RLS). 0 linhas atualizadas => sem permissão ou já não existe. */
export async function reviewTestimonial(id: string, status: "approved" | "rejected"): Promise<TestimonialResult> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("testimonials").update({ status }).eq("id", id).select(TESTIMONIAL_COLUMNS);
    if (error) return { ok: false, error: friendlyTestimonialError(error) };
    const row = ((data as unknown as TestimonialRow[] | null) ?? [])[0];
    if (!row) return { ok: false, error: "Não foi possível atualizar: o depoimento não existe mais ou você não pode decidir sobre ele. Atualize a página." };
    return { ok: true, testimonial: rowToTestimonial(row) };
  } catch (e) {
    return { ok: false, error: friendlyTestimonialError(e as { message?: string }) };
  }
}

export async function deleteTestimonial(id: string): Promise<TestimonialResult> {
  try {
    const supabase = createClient();
    const { error, count } = await supabase.from("testimonials").delete({ count: "exact" }).eq("id", id);
    if (error) return { ok: false, error: friendlyTestimonialError(error) };
    if (!count) return { ok: false, error: "Este depoimento já foi apagado ou você não tem permissão para apagá-lo. Atualize a página." };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyTestimonialError(e as { message?: string }) };
  }
}
