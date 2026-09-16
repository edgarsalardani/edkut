import { Comment } from "@/types";

export const comments: Comment[] = [
  {
    id: "cm1",
    postId: "p1",
    authorId: "u9",
    text: "Concordo demais. A gente separa IHC e ontologias como se fossem mundos diferentes, mas os dois falam de como representar significado.",
    createdAt: "2026-09-10T14:05:00.000Z",
  },
  {
    id: "cm2",
    postId: "p1",
    authorId: "u4",
    text: "Isso daria uma ótima linha de pesquisa pra orientação de TCC, Edgar!",
    createdAt: "2026-09-10T14:22:00.000Z",
  },
  {
    id: "cm3",
    postId: "p2",
    authorId: "u8",
    text: "Já coloquei na fila de leitura. A cada semana tem um paper novo prometendo resolver tudo 😅",
    createdAt: "2026-09-11T09:15:00.000Z",
  },
  {
    id: "cm4",
    postId: "p3",
    authorId: "u16",
    text: "Eu odeio diagrama sem multiplicidade, então esse post fala direto comigo.",
    createdAt: "2026-09-09T19:40:00.000Z",
  },
  {
    id: "cm5",
    postId: "p3",
    authorId: "u10",
    text: "Normalizar até a 3FN e depois desnormalizar 'só um pouquinho' é osso.",
    createdAt: "2026-09-09T20:02:00.000Z",
  },
  {
    id: "cm6",
    postId: "p4",
    authorId: "u1",
    text: "Clássico. Removeu um console.log e quebrou a build inteira.",
    createdAt: "2026-09-12T11:30:00.000Z",
  },
  {
    id: "cm7",
    postId: "p4",
    authorId: "u3",
    text: "Isso é folclore de engenheiro de software, acontece em toda empresa.",
    createdAt: "2026-09-12T11:41:00.000Z",
  },
  {
    id: "cm8",
    postId: "p4",
    authorId: "u15",
    text: "Vou printar isso e colar na parede do time.",
    createdAt: "2026-09-12T12:03:00.000Z",
  },
  {
    id: "cm9",
    postId: "p5",
    authorId: "u12",
    text: "Achado importante. Teste com leitor de tela deveria ser obrigatório em toda entrega.",
    createdAt: "2026-09-08T16:12:00.000Z",
  },
  {
    id: "cm10",
    postId: "p7",
    authorId: "u11",
    text: "Passei por algo parecido num deploy de sexta-feira. Nunca mais.",
    createdAt: "2026-09-05T22:10:00.000Z",
  },
  {
    id: "cm11",
    postId: "p8",
    authorId: "u5",
    text: "Só mais um artigo e eu começo o TCC também, literalmente minha vida.",
    createdAt: "2026-09-07T18:20:00.000Z",
  },
  {
    id: "cm12",
    postId: "p8",
    authorId: "u9",
    text: "Define um escopo pequeno e defende ele. Depois expande se der tempo.",
    createdAt: "2026-09-07T18:45:00.000Z",
  },
  {
    id: "cm13",
    postId: "p9",
    authorId: "u4",
    text: "'Deixa mais clean' é a frase que mais ouço em reunião de design.",
    createdAt: "2026-09-13T10:05:00.000Z",
  },
  {
    id: "cm14",
    postId: "p11",
    authorId: "u1",
    text: "Depende muito do contexto do projeto. Em times pequenos, às vezes 3 camadas já resolve bem.",
    createdAt: "2026-09-06T15:30:00.000Z",
  },
  {
    id: "cm15",
    postId: "p12",
    authorId: "u2",
    text: "Muito bom, salvei pra reler antes da minha próxima entrevista.",
    createdAt: "2026-09-04T13:00:00.000Z",
  },
  {
    id: "cm16",
    postId: "p12",
    authorId: "u7",
    text: "O ponto sobre perguntar sobre a cultura do time na entrevista é ouro.",
    createdAt: "2026-09-04T13:22:00.000Z",
  },
  {
    id: "cm17",
    postId: "p13",
    authorId: "u1",
    text: "Bem-vinda ao EdKut, Carolina! Multiplicidade sem cardinalidade clara é dor de cabeça garantida mesmo.",
    createdAt: "2026-09-13T20:15:00.000Z",
  },
  {
    id: "cm18",
    postId: "p14",
    authorId: "u3",
    text: "Comecei monolito nesse projeto de propósito. Migrar depois é mais fácil que desfazer microsserviço prematuro.",
    createdAt: "2026-09-02T17:00:00.000Z",
  },
  {
    id: "cm19",
    postId: "p15",
    authorId: "u6",
    text: "Projeto muito bacana. A parte de histórico de evolução do paciente ficou bem pensada.",
    createdAt: "2026-08-30T14:40:00.000Z",
  },
];

export function getCommentsByIds(ids: string[]): Comment[] {
  return ids
    .map((id) => comments.find((c) => c.id === id))
    .filter((c): c is Comment => Boolean(c));
}
