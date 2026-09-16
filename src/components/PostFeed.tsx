"use client";

import { useState } from "react";
import { Post, User } from "@/types";
import { PostCard } from "./PostCard";
import { CreatePostBox } from "./CreatePostBox";

interface PostFeedProps {
  initialPosts: Post[];
  currentUser: User;
  communityId?: string;
  emptyMessage?: string;
}

/**
 * Lista de publicações com caixa de criação no topo. É Client Component
 * porque precisa inserir a nova publicação no topo do feed imediatamente
 * após "publicar" (sem depender de reload) — no protótipo mockado, o post
 * criado só vive no estado local desta sessão.
 */
export function PostFeed({ initialPosts, currentUser, communityId, emptyMessage }: PostFeedProps) {
  const [posts, setPosts] = useState(initialPosts);

  return (
    <div className="flex flex-col gap-4">
      <CreatePostBox
        currentUser={currentUser}
        communityId={communityId}
        onPostCreated={(post) => setPosts((prev) => [post, ...prev])}
      />

      {posts.length === 0 ? (
        <div className="edkut-card p-6 text-center text-sm text-edkut-muted">
          {emptyMessage ?? "Ainda não há publicações por aqui. Seja a primeira pessoa a compartilhar algo!"}
        </div>
      ) : (
        posts.map((post) => <PostCard key={post.id} post={post} currentUser={currentUser} />)
      )}
    </div>
  );
}
