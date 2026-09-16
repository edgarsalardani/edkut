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

/** Os três indicadores sociais de perfil do EdKut (ver seção 9 da spec). */
export interface TechProfileScore {
  tech: number; // 0-100
  parceiro: number; // 0-100
  geek: number; // 0-100
}

export interface User {
  id: string;
  name: string;
  username: string;
  avatarEmoji: string; // usado como "foto" leve no protótipo (sem assets externos)
  avatarColor: string; // cor de fundo do avatar
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
}

export interface Testimonial {
  id: string;
  profileOwnerId: string; // sobre quem é o depoimento
  authorId: string;
  message: string;
  createdAt: string;
  approved: boolean; // na V1 mockada, todos os exibidos já estão aprovados
}

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
