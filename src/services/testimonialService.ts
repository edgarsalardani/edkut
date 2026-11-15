// ---------------------------------------------------------------------------
// Depoimentos (SOMENTE SERVIDOR): leitura real de public.testimonials. A RLS já decide o que cada pessoa vê:
//   - qualquer logado: depoimentos `approved`;
//   - o autor: os próprios (em qualquer status); o destinatário: todos os recebidos.
// Envio/aprovação/exclusão ficam em lib/testimonials.ts (navegador). Sem dados fictícios.
// ---------------------------------------------------------------------------
import { createClient } from "@/lib/supabase/server";
import { getProfileUsersByIds } from "@/services/authService";
import { TESTIMONIAL_COLUMNS, rowToTestimonial } from "@/lib/testimonials";
import { isUuid } from "@/lib/uuid";
import type { Testimonial, User } from "@/types";

export const TESTIMONIAL_LIST_LIMIT = 50;

export interface TestimonialsData {
  testimonials: Testimonial[];
  authors: User[];
  error: boolean;
}

export async function getTestimonialsWithAuthors(profileOwnerId: string): Promise<TestimonialsData> {
  if (!isUuid(profileOwnerId)) return { testimonials: [], authors: [], error: false };
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("testimonials")
      .select(TESTIMONIAL_COLUMNS)
      .eq("profile_owner_id", profileOwnerId)
      .order("created_at", { ascending: false })
      .limit(TESTIMONIAL_LIST_LIMIT);
    if (error) throw new Error(error.message);
    const testimonials = ((data as unknown as Parameters<typeof rowToTestimonial>[0][] | null) ?? []).map(rowToTestimonial);
    const authors = await getProfileUsersByIds(testimonials.map((t) => t.authorId));
    return { testimonials, authors, error: false };
  } catch (e) {
    console.error("[depoimentos]", e instanceof Error ? e.message : "erro desconhecido");
    return { testimonials: [], authors: [], error: true };
  }
}
