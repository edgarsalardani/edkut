"use client";

import { FormEvent, useState } from "react";
import { Post, User } from "@/types";
import { UserAvatar } from "./Avatar";
import { createPost } from "@/services/postService";

interface CreatePostBoxProps {
  currentUser: User;
  communityId?: string;
  onPostCreated: (post: Post) => void;
}

/** Caixa "O que você está estudando ou pensando hoje?" — cria publicações de texto (ver seção 7 da spec). */
export function CreatePostBox({ currentUser, communityId, onPostCreated }: CreatePostBoxProps) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setSubmitting(true);
    const newPost = await createPost({ authorId: currentUser.id, text: trimmed, communityId });
    onPostCreated(newPost);
    setText("");
    setSubmitting(false);
  }

  return (
    <div className="edkut-card p-3.5">
      <form onSubmit={handleSubmit} className="flex gap-2.5">
        <UserAvatar user={currentUser} size="sm" />
        <div className="flex-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="O que você está estudando ou pensando hoje?"
            rows={2}
            className="edkut-input resize-none"
            disabled={submitting}
          />
          <div className="mt-2 flex justify-end">
            <button type="submit" className="edkut-btn-pink" disabled={submitting || !text.trim()}>
              publicar
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
