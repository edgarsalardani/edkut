// ---------------------------------------------------------------------------
// Tipos centrais do EdKut.
//
// Esta camada representa o "contrato" de dados da aplicação. Hoje os dados
// são servidos por mocks (src/mocks) através dos services (src/services),
// mas os componentes só conhecem estes tipos — nunca os mocks diretamente.
// Quando um backend real existir, basta trocar a implementação dos services
// por chamadas HTTP/API mantendo estas interfaces (ou evoluindo-as).
// ---------------------------------------------------------------------------

export type UserType = "professor" | "estudante" | "egresso" | "profissional";

/**
 * Os três indicadores sociais de perfil do EdKut, na ordem de exibição: NERD · PARCEIRO · TECH.
 * `nerd` é o antigo "GEEK" (só o rótulo/chave do frontend mudou; no banco a coluna continua
 * `profile_scores.geek_base` — ver mapeamento em services/authService.ts).
 */
export interface TechProfileScore {
  nerd: number; // 0-100
  parceiro: number; // 0-100
  tech: number; // 0-100
}

export interface User {
  id: string;
  name: string;
  username: string;
  avatarEmoji: string; // avatar padrão (emoji + cor) para quem não enviou foto
  avatarColor: string; // cor de fundo do avatar
  avatarUrl?: string; // foto enviada (Supabase Storage, URL pública); ausente => avatar padrão
  userType: UserType;
  headline: string; // ex: "Professor | Pesquisador"
  bio: string;
  institution?: string;
  courseOrArea?: string;
  location?: string;
  interests: string[];
  friendIds: string[];
  communityIds: string[];
  techProfile: TechProfileScore;
  /** Quantos amigos contribuem para os indicadores (só perfis reais; ausente nos usuários fictícios). */
  ratingsCount?: number;
  joinedAt: string; // ISO date
  online?: boolean;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  createdAt: string;
  status: "pending" | "accepted" | "declined";
}

export type CommunityCategory =
  | "Desenvolvimento"
  | "Engenharia de Software"
  | "IHC e Design"
  | "Dados e IA"
  | "Infraestrutura"
  | "Pesquisa"
  | "Carreira"
  | "Acadêmico"
  | "Geral";

export interface Community {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  category: CommunityCategory;
  emoji: string; // "imagem" leve da comunidade no protótipo
  color: string;
  memberIds: string[]; // membros "conhecidos" no protótipo (usados para listas/avatares)
  memberCount: number; // total exibido (uma comunidade real teria muito mais membros que usuários mockados)
  creatorId: string;
  moderatorIds: string[];
  createdAt: string;
}

// --- Comunidades REAIS (Supabase; migrações 4, 12 e 13) ---------------------------------------------
// Os tipos `Community` acima pertencem ao protótipo com dados fictícios e não são usados pelas telas reais.

/** 'open' = entra na hora; 'approval' = solicita e aguarda criador/moderador. Independe da visibilidade. */
export type JoinPolicy = "open" | "approval";
export type CommunityRole = "member" | "moderator";
export type JoinRequestStatus = "pending" | "approved" | "declined" | "canceled";

export interface CommunityInfo {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  category: string;
  emoji: string;
  color: string;
  /** URL pública da imagem (bucket community-images); ausente => emoji + cor. */
  imageUrl?: string;
  joinPolicy: JoinPolicy;
  /** Nulo quando a conta do criador foi excluída. */
  creatorId: string | null;
  memberCount: number;
  createdAt: string;
}

export interface CommunityMemberInfo {
  userId: string;
  role: CommunityRole;
  joinedAt: string;
}

export interface JoinRequestInfo {
  id: string;
  communityId: string;
  userId: string;
  createdAt: string;
}

/**
 * Tipo de publicação. "texto" é o único totalmente suportado na V1.
 * Os demais já existem no modelo para não travar a evolução futura
 * (ver seção 18/19 da spec), mas a UI da V1 só cria posts de texto.
 */
export type PostKind = "texto" | "imagem" | "link" | "codigo" | "enquete" | "projeto";

export interface ProjectDetails {
  title: string;
  description: string;
  technologies: string[];
  githubUrl?: string;
}

export interface Post {
  id: string;
  authorId: string;
  communityId?: string; // presente quando o post foi publicado dentro de uma comunidade
  kind: PostKind;
  text: string;
  project?: ProjectDetails; // usado apenas quando kind === "projeto"
  createdAt: string;
  likedByUserIds: string[];
  commentIds: string[];
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  text: string;
  createdAt: string;
}

export interface Scrap {
  id: string;
  profileOwnerId: string; // em qual perfil o scrap foi deixado
  authorId: string;
  message: string;
  createdAt: string;
  /** Id do scrap original quando este é uma RESPOSTA (migração 11); nulo/ausente nos scraps raiz. */
  parentId?: string | null;
}

export interface Testimonial {
  id: string;
  profileOwnerId: string; // sobre quem é o depoimento
  authorId: string;
  message: string;
  createdAt: string;
  approved: boolean; // true somente quando status === "approved"
  /** Estado real no banco (public.testimonials.status). Ausente só em dados antigos. */
  status?: TestimonialStatus;
}

export type TestimonialStatus = "pending" | "approved" | "rejected";

export type NotificationKind =
  | "friend_accept"
  | "friend_request"
  | "comment"
  | "scrap"
  | "testimonial"
  | "community_post";

export interface AppNotification {
  id: string;
  userId: string; // destinatário
  kind: NotificationKind;
  message: string;
  actorId?: string;
  targetId?: string; // id do post, comunidade, etc., quando aplicável
  createdAt: string;
  read: boolean;
}

export interface SearchResults {
  people: User[];
  communities: Community[];
  posts: Post[];
}

// ----------------------------- perfil clássico (migração 14) -----------------------------

export type RelationshipKey = "solteiro" | "namorando" | "casado" | "uniao_estavel" | "relacionamento_aberto" | "complicado";

/** Dados pessoais extras do perfil (colunas novas de profiles). Campos vazios ficam ausentes. */
export interface ProfileExtras {
  statusPhrase?: string;
  relationship?: RelationshipKey;
  /** AAAA-MM-DD. O app mostra só dia e mês. */
  birthday?: string;
  hobbies?: string;
}

export interface ProfilePhoto {
  id: string;
  ownerId: string;
  /** Caminho no bucket profile-photos ("<dono>/<arquivo>"). */
  path: string;
  url: string;
  caption: string;
  createdAt: string;
}

export interface ProfileVideo {
  id: string;
  ownerId: string;
  /** Só o id de 11 caracteres; miniatura e player são montados pelo app. */
  youtubeId: string;
  title: string;
  description: string;
  createdAt: string;
}

/** Comunidade em miniatura (coluna direita do perfil e lista "ver todas"). */
export interface ProfileCommunity {
  id: string;
  name: string;
  emoji: string;
  color: string;
  imageUrl?: string;
  memberCount: number;
}

// ----- Fórum das comunidades (migração 15) -----
/** Autor de um tópico/mensagem (dados mínimos para foto, nome e link). */
export interface ForumAuthor {
  id: string;
  name: string;
  avatarEmoji: string;
  avatarColor: string;
  avatarUrl?: string;
}

export interface ForumTopic {
  id: string;
  communityId: string;
  /** null = conta do autor excluída. */
  authorId: string | null;
  title: string;
  body: string;
  /** Comentários + respostas. */
  replyCount: number;
  lastActivityAt: string;
  createdAt: string;
}

/** Comentário (parentId nulo) ou resposta a um comentário. */
export interface ForumMessage {
  id: string;
  topicId: string;
  parentId: string | null;
  authorId: string | null;
  body: string;
  createdAt: string;
}
