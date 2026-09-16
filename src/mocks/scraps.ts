import { Scrap } from "@/types";

export const scraps: Scrap[] = [
  {
    id: "s1",
    profileOwnerId: "u1",
    authorId: "u4",
    message: "Edgar, adorei a discussão de hoje sobre ontologias aplicadas a IHC. Bora escrever um artigo juntos sobre isso?",
    createdAt: "2026-09-12T18:30:00.000Z",
  },
  {
    id: "s2",
    profileOwnerId: "u1",
    authorId: "u5",
    message: "Professor, obrigado pelas correções no meu capítulo de metodologia. Já ficou bem mais claro!",
    createdAt: "2026-09-11T20:10:00.000Z",
  },
  {
    id: "s3",
    profileOwnerId: "u1",
    authorId: "u2",
    message: "Marina passando aqui só pra dizer que sua aula de arquitetura salvou meu projeto final 🙏",
    createdAt: "2026-09-09T14:45:00.000Z",
  },
  {
    id: "s4",
    profileOwnerId: "u1",
    authorId: "u9",
    message: "Edgar, te chamei pra revisar aquele paper de ontologias. Dá uma olhada quando puder.",
    createdAt: "2026-09-06T11:00:00.000Z",
  },
  {
    id: "s5",
    profileOwnerId: "u1",
    authorId: "u7",
    message: "Falou rapidão comigo sobre carreira depois da aula e mudou minha visão sobre o mestrado. Valeu, professor!",
    createdAt: "2026-09-01T16:20:00.000Z",
  },
  {
    id: "s6",
    profileOwnerId: "u1",
    authorId: "u12",
    message: "Alguém aqui do grupo de TCC recomendou seu nome pra banca. Posso te chamar?",
    createdAt: "2026-08-27T09:15:00.000Z",
  },
  {
    id: "s7",
    profileOwnerId: "u2",
    authorId: "u1",
    message: "Marina, seu último post sobre modelagem de dados ficou excelente. Vou usar como exemplo em aula!",
    createdAt: "2026-09-09T20:00:00.000Z",
  },
  {
    id: "s8",
    profileOwnerId: "u2",
    authorId: "u8",
    message: "A gente definitivamente deveria trocar mais ideia sobre engenharia de dados, Marina.",
    createdAt: "2026-09-05T13:30:00.000Z",
  },
  {
    id: "s9",
    profileOwnerId: "u5",
    authorId: "u9",
    message: "Rafael, sua apresentação no grupo de pesquisa ficou muito boa. Já quero ver o próximo experimento.",
    createdAt: "2026-09-08T10:00:00.000Z",
  },
  {
    id: "s10",
    profileOwnerId: "u4",
    authorId: "u12",
    message: "Professora, obrigada por defender acessibilidade até o fim naquela reunião com o cliente. Precisava disso.",
    createdAt: "2026-09-07T17:40:00.000Z",
  },
];

export function getScrapsByProfile(profileOwnerId: string): Scrap[] {
  return scraps
    .filter((s) => s.profileOwnerId === profileOwnerId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
