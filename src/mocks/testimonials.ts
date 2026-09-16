import { Testimonial } from "@/types";

export const testimonials: Testimonial[] = [
  {
    id: "t1",
    profileOwnerId: "u1",
    authorId: "u3",
    message: "Professor que me fez descobrir que arquitetura não é apenas desenhar caixinhas.",
    createdAt: "2026-08-20T10:00:00.000Z",
    approved: true,
  },
  {
    id: "t2",
    profileOwnerId: "u1",
    authorId: "u4",
    message: "Um dos poucos professores de exatas que realmente entende o valor de IHC. Referência pra mim até hoje.",
    createdAt: "2026-08-15T10:00:00.000Z",
    approved: true,
  },
  {
    id: "t3",
    profileOwnerId: "u1",
    authorId: "u5",
    message: "Orientador presente, crítico e generoso com o tempo. Minha dissertação não seria a mesma sem as orientações dele.",
    createdAt: "2026-08-05T10:00:00.000Z",
    approved: true,
  },
  {
    id: "t4",
    profileOwnerId: "u1",
    authorId: "u9",
    message: "Parceiro de pesquisa desde 2019. Nossas discussões sobre ontologias renderam pelo menos três artigos bons.",
    createdAt: "2026-07-22T10:00:00.000Z",
    approved: true,
  },
  {
    id: "t5",
    profileOwnerId: "u1",
    authorId: "u7",
    message: "Aula de arquitetura de software dele mudou como eu penso sistema. Recomendo pra qualquer estudante de ES.",
    createdAt: "2026-07-10T10:00:00.000Z",
    approved: true,
  },
  {
    id: "t6",
    profileOwnerId: "u2",
    authorId: "u8",
    message: "Marina tem um olhar raro pra modelagem de dados. Trabalhar com ela levantou o nível do time inteiro.",
    createdAt: "2026-08-01T10:00:00.000Z",
    approved: true,
  },
  {
    id: "t7",
    profileOwnerId: "u4",
    authorId: "u1",
    message: "Colega de departamento que sempre traz o usuário de volta pro centro da discussão. Aprendo muito com ela.",
    createdAt: "2026-07-28T10:00:00.000Z",
    approved: true,
  },
];

export function getTestimonialsByProfile(profileOwnerId: string): Testimonial[] {
  return testimonials
    .filter((t) => t.profileOwnerId === profileOwnerId && t.approved)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
