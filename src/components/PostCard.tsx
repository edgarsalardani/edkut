"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Post, User } from "@/types";
import { UserAvatar } from "./Avatar";
import { Comment } from "./Comment";
import { getUserById } from "@/mocks/users";
import { getCommunityById } from "@/mocks/communities";
import { getCommentsByIds } from "@/mocks/comments";
import { createComment, toggleLike } from "@/services/postService";
import { formatRelativeTime } from "@/lib/format";

interface PostCardProps {
  post: Post;
  currentUser: User;
}

/**
 * Renderiza uma publicação do feed ou de uma comunidade. É um Client
 * Component porque curtir/comentar precisa de estado local imediato —
 * numa integração futura com API real, os handlers abaixo chamariam
 * postService.toggleLike / postService.createComment de verdade e
 * sincronizariam com o servidor (ver services/postService.ts).
 */
export function PostCard({ post, currentUser }: PostCardProps) {
  const author = getUserById(post.authorId);
  const community = post.communityId ? getCommunityById(post.communityId) : undefined;

  const [liked, setLiked] = useState(post.likedByUserIds.includes(currentUser.id));
  const [likeCount, setLikeCount] = useState(post.likedByUserIds.length);
  const [comments, setComments] = useState(() => getCommentsByIds(post.commentIds));
  const [showComments, setShowComments] = useState(comments.length > 0);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!author) return null;

  async function handleToggleLike() {
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount((c) => (nextLiked ? c + 1 : c - 1));
    await toggleLike(post.id, currentUser.id, nextLiked);
  }

  async function handleAddComment(e: FormEvent) {
    e.preventDefault();
    const text = commentText.trim();
    if (!text) return;
    setSubmitting(true);
    const newComment = await createComment({ postId: post.id, authorId: currentUser.id, text });
    setComments((prev) => [...prev, newComment]);
    setCommentText("");
    setShowComments(true);
    setSubmitting(false);
  }

  return (
    <article className="rounded-edkut border border-edkut-border bg-white p-3">
      <header className="flex items-start gap-2.5">
        <Link href={`/profile/${author.id}`}>
          <UserAvatar user={author} size="sm" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <Link href={`/profile/${author.id}`} className="font-heading text-sm font-bold text-edkut-blue hover:underline">
              {author.name}
            </Link>
            {community && (
              <>
                <span className="text-xs text-edkut-faint">em</span>
                <Link href={`/communities/${community.id}`} className="text-xs font-semibold text-edkut-pink hover:underline">
                  {community.name}
                </Link>
              </>
            )}
          </div>
          <p className="text-xs text-edkut-faint">{formatRelativeTime(post.createdAt)}</p>
        </div>
      </header>

      <div className="mt-2.5 whitespace-pre-line text-sm text-edkut-text">{post.text}</div>

      {post.kind === "projeto" && post.project && (
        <div className="mt-3 rounded-edkut border border-edkut-border bg-edkut-blueSoft p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-edkut-pink">projeto</p>
          <p className="font-heading text-sm font-bold text-edkut-blue">{post.project.title}</p>
          <p className="mt-1 text-sm text-edkut-text">{post.project.description}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {post.project.technologies.map((tech) => (
              <span key={tech} className="edkut-tag">
                {tech}
              </span>
            ))}
          </div>
          {post.project.githubUrl && (
            <a
              href={post.project.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="edkut-link mt-2 inline-block text-xs font-semibold"
            >
              ver no GitHub
            </a>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-4 border-t border-edkut-border pt-2 text-sm">
        <button
          onClick={handleToggleLike}
          className={`flex items-center gap-1 font-heading font-bold ${liked ? "text-edkut-pink" : "text-edkut-muted hover:text-edkut-pink"}`}
        >
          <span aria-hidden="true">{liked ? "♥" : "♡"}</span> curtir
          {likeCount > 0 && <span className="font-normal text-edkut-faint">({likeCount})</span>}
        </button>
        <button
          onClick={() => setShowComments((s) => !s)}
          className="flex items-center gap-1 font-heading font-bold text-edkut-muted hover:text-edkut-blue"
        >
          💬 comentar
          {comments.length > 0 && <span className="font-normal text-edkut-faint">({comments.length})</span>}
        </button>
      </div>

      {showComments && (
        <div className="mt-2 border-t border-edkut-border pt-2">
          {comments.map((comment) => (
            <Comment key={comment.id} comment={comment} author={getUserById(comment.authorId)} />
          ))}

          <form onSubmit={handleAddComment} className="mt-2 flex items-center gap-2">
            <UserAvatar user={currentUser} size="xs" />
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="escreva um comentário..."
              className="edkut-input py-1"
              disabled={submitting}
            />
            <button type="submit" className="edkut-btn-outline py-1" disabled={submitting || !commentText.trim()}>
              enviar
            </button>
          </form>
        </div>
      )}
    </article>
  );
}
