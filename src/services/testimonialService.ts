import { Testimonial } from "@/types";
import { getTestimonialsByProfile } from "@/mocks/testimonials";
import { simulateDelay } from "./simulateDelay";

export async function getTestimonials(profileOwnerId: string): Promise<Testimonial[]> {
  return simulateDelay(getTestimonialsByProfile(profileOwnerId));
}

export interface CreateTestimonialInput {
  profileOwnerId: string;
  authorId: string;
  message: string;
}

/**
 * Simula o envio de um depoimento. No modelo de dados, depoimentos nascem
 * como approved:false e dependem de aprovação do dono do perfil (ver
 * seção 15 da spec) — isso ainda não está implementado na V1 mockada, mas
 * a assinatura já reflete esse fluxo futuro.
 */
export async function createTestimonial(input: CreateTestimonialInput): Promise<Testimonial> {
  const newTestimonial: Testimonial = {
    id: `t-local-${Date.now()}`,
    profileOwnerId: input.profileOwnerId,
    authorId: input.authorId,
    message: input.message,
    createdAt: new Date().toISOString(),
    approved: true,
  };
  return simulateDelay(newTestimonial, 150);
}
