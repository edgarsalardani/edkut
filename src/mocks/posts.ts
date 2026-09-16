import { Post } from "@/types";

export const posts: Post[] = [
  {
    id: "p1",
    authorId: "u1",
    kind: "texto",
    text: "Reparando que boa parte dos problemas de IHC que discutimos em sala também aparecem em modelagem de ontologias: no fundo, os dois campos tentam responder 'como representamos significado pra alguém entender'.",
    createdAt: "2026-09-10T13:50:00.000Z",
    likedByUserIds: ["u4", "u5", "u9", "u12"],
    commentIds: ["cm1", "cm2"],
  },
  {
    id: "p2",
    authorId: "u5",
    communityId: "c6",
    kind: "texto",
    text: "Encontrei um paper interessante sobre avaliação de LLMs em tarefas de raciocínio estruturado. Alguém já leu algo parecido e quer trocar ideia?",
    createdAt: "2026-09-11T09:00:00.000Z",
    likedByUserIds: ["u1", "u8", "u16"],
    commentIds: ["cm3"],
  },
  {
    id: "p3",
    authorId: "u2",
    kind: "texto",
    text: "Passei a tarde inteira normalizando um esquema de banco e no fim decidi desnormalizar 'só um pouquinho' pra performance. Modelagem de dados é sempre um exercício de escolher qual dor você prefere sentir.",
    createdAt: "2026-09-09T19:20:00.000Z",
    likedByUserIds: ["u1", "u8", "u10", "u16"],
    commentIds: ["cm4", "cm5"],
  },
  {
    id: "p4",
    authorId: "u7",
    communityId: "c10",
    kind: "texto",
    text: "Passei 3 horas quebrando a cabeça com um bug. A causa era um ponto e vírgula que eu mesmo tinha apagado sem perceber. Meu código funciona, eu simplesmente não sei por quê.",
    createdAt: "2026-09-12T11:15:00.000Z",
    likedByUserIds: ["u1", "u3", "u9", "u15", "u10"],
    commentIds: ["cm6", "cm7", "cm8"],
  },
  {
    id: "p5",
    authorId: "u4",
    communityId: "c2",
    kind: "texto",
    text: "Fizemos um teste rápido de leitor de tela em três apps de delivery bem conhecidas. Nenhuma passou sem ajuda. Ainda tem muito trabalho de acessibilidade pela frente na indústria.",
    createdAt: "2026-09-08T15:50:00.000Z",
    likedByUserIds: ["u1", "u9", "u12", "u13"],
    commentIds: ["cm9"],
  },
  {
    id: "p6",
    authorId: "u9",
    communityId: "c3",
    kind: "texto",
    text: "Dúvida pra quem trabalha com ontologias: vocês preferem modelar relações transitivas explicitamente ou deixar o raciocinador inferir? Estou revisando uma ontologia de domínio acadêmico e bati nessa decisão.",
    createdAt: "2026-09-07T10:30:00.000Z",
    likedByUserIds: ["u1", "u5"],
    commentIds: [],
  },
  {
    id: "p7",
    authorId: "u3",
    kind: "texto",
    text: "Aprendi (de novo) que deploy em sexta à tarde é uma escolha de vida. Rollback feito, lição aprendida, café tomado.",
    createdAt: "2026-09-05T21:45:00.000Z",
    likedByUserIds: ["u1", "u6", "u11"],
    commentIds: ["cm10"],
  },
  {
    id: "p8",
    authorId: "u10",
    communityId: "c13",
    kind: "texto",
    text: "Dia 47 lendo trabalhos relacionados. Juro que amanhã começo a escrever o capítulo de metodologia. Só mais um artigo.",
    createdAt: "2026-09-07T18:00:00.000Z",
    likedByUserIds: ["u5", "u9", "u2", "u12"],
    commentIds: ["cm11", "cm12"],
  },
  {
    id: "p9",
    authorId: "u1",
    communityId: "c9",
    kind: "texto",
    text: "Pedido de stakeholder da semana: 'deixa a tela mais clean, mas sem tirar nenhuma informação'. IHC não é só deixar bonito, gente.",
    createdAt: "2026-09-13T09:40:00.000Z",
    likedByUserIds: ["u4", "u12", "u13", "u9"],
    commentIds: ["cm13"],
  },
  {
    id: "p10",
    authorId: "u8",
    kind: "texto",
    text: "Depois de meses de discussão, finalmente migramos o pipeline de dados pra um modelo em camadas (bronze/prata/ouro). A diferença na governança já é visível.",
    createdAt: "2026-09-03T14:10:00.000Z",
    likedByUserIds: ["u5", "u1"],
    commentIds: [],
  },
  {
    id: "p11",
    authorId: "u12",
    communityId: "c14",
    kind: "texto",
    text: "Alguém consegue me convencer, na prática, de que vale a pena aplicar Clean Architecture num projeto pequeno de TCC? Ou é overengineering?",
    createdAt: "2026-09-06T15:10:00.000Z",
    likedByUserIds: ["u13", "u3"],
    commentIds: ["cm14"],
  },
  {
    id: "p12",
    authorId: "u15",
    communityId: "c8",
    kind: "texto",
    text: "Entrevistei mais de 40 pessoas pra vagas de backend esse ano. Resumo rápido: comunicar o raciocínio importa tanto quanto chegar na resposta certa. E pergunte sobre a cultura do time, isso conta muito.",
    createdAt: "2026-09-04T12:40:00.000Z",
    likedByUserIds: ["u2", "u7", "u3", "u6"],
    commentIds: ["cm15", "cm16"],
  },
  {
    id: "p13",
    authorId: "u16",
    kind: "texto",
    text: "Primeira publicação por aqui! Alguém tem dica de material bom sobre multiplicidade em diagramas de classe? Ainda erro na hora de decidir entre 0..1, 1 e 1..*.",
    createdAt: "2026-09-13T19:55:00.000Z",
    likedByUserIds: ["u1", "u7"],
    commentIds: ["cm17"],
  },
  {
    id: "p14",
    authorId: "u3",
    communityId: "c5",
    kind: "texto",
    text: "Comecei um projeto novo como monolito de propósito. Extrair um microsserviço depois é bem mais barato do que desfazer uma decomposição prematura.",
    createdAt: "2026-09-02T16:30:00.000Z",
    likedByUserIds: ["u11", "u6", "u1"],
    commentIds: ["cm18"],
  },
  {
    id: "p15",
    authorId: "u11",
    kind: "projeto",
    text: "Projeto que desenvolvi no último semestre da faculdade, hoje mantido como estudo pessoal de arquitetura em camadas.",
    project: {
      title: "Sistema de acompanhamento veterinário",
      description:
        "Aplicação desenvolvida para acompanhamento da evolução de pacientes, com histórico de consultas, vacinas e exames.",
      technologies: ["React", "Node", "PostgreSQL"],
      githubUrl: "https://github.com/exemplo/acompanhamento-veterinario",
    },
    createdAt: "2026-08-30T14:20:00.000Z",
    likedByUserIds: ["u3", "u6", "u1"],
    commentIds: ["cm19"],
  },
];

export function getPostById(id: string): Post | undefined {
  return posts.find((p) => p.id === id);
}

export function getPostsByCommunity(communityId: string): Post[] {
  return posts
    .filter((p) => p.communityId === communityId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getPostsByAuthor(authorId: string): Post[] {
  return posts
    .filter((p) => p.authorId === authorId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
