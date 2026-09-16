import { Comment, Post, PostKind } from "@/types";
import { posts, getPostsByAuthor as findByAuthor, getPostsByCommunity as findByCommunity } from "@/mocks/posts";
import { comments as commentsMock, getCommentsByIds } from "@/mocks/comments";
import { simulateDelay } from "./simulateDelay";

function sortByDateDesc(list: Post[]): Post[] {
  return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** Feed cronológico geral (pessoas + comunidades), sem algoritmo de recomendação. */
export async function getFeedPosts(): Promise<Post[]> {
  return simulateDelay(sortByDateDesc(posts));
}

export async function getPostsByAuthor(authorId: string): Promise<Post[]> {
  return simulateDelay(findByAuthor(authorId));
}

export async function getPostsByCommunity(communityId: string): Promise<Post[]> {
  return simulateDelay(findByCommunity(communityId));
}

export async function getCommentsForPost(post: Post): Promise<Comment[]> {
  return simulateDelay(getCommentsByIds(post.commentIds));
}

export interface CreatePostInput {
  authorId: string;
  text: string;
  communityId?: string;
  kind?: PostKind;
}

/**
 * Simula a criação de uma publicação. Como esta V1 não tem backend, o post
 * retornado deve ser adicionado ao estado local do componente que chamou
 * (ele não persiste entre recarregamentos de página).
 */
export async function createPost(input: CreatePostInput): Promise<Post> {
  const newPost: Post = {
    id: `p-local-${Date.now()}`,
    authorId: input.authorId,
    communityId: input.communityId,
    kind: input.kind ?? "texto",
    text: input.text,
    createdAt: new Date().toISOString(),
    likedByUserIds: [],
    commentIds: [],
  };
  return simulateDelay(newPost, 200);
}

export interface CreateCommentInput {
  postId: string;
  authorId: string;
  text: string;
}

export async function createComment(input: CreateCommentInput): Promise<Comment> {
  const newComment: Comment = {
    id: `cm-local-${Date.now()}`,
    postId: input.postId,
    authorId: input.authorId,
    text: input.text,
    createdAt: new Date().toISOString(),
  };
  return simulateDelay(newComment, 150);
}

/** Simula curtir/descurtir. O componente decide o novo estado (otimista) e chama isso só para manter o formato de uma futura chamada de API. */
export async function toggleLike(postId: string, userId: string, nextLiked: boolean): Promise<{ postId: string; userId: string; liked: boolean }> {
  return simulateDelay({ postId, userId, liked: nextLiked }, 100);
}

export const allCommentsMock = commentsMock;
