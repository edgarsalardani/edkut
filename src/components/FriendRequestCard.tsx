"use client";

import { useState } from "react";
import Link from "next/link";
import { User } from "@/types";
import { UserAvatar } from "./Avatar";
import { acceptFriendRequest, declineFriendRequest } from "@/services/friendService";

interface FriendRequestCardProps {
  requestId: string;
  fromUser: User;
  onResolved: (requestId: string, status: "accepted" | "declined") => void;
}

export function FriendRequestCard({ requestId, fromUser, onResolved }: FriendRequestCardProps) {
  const [loading, setLoading] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setLoading("accept");
    setError(null);
    const result = await acceptFriendRequest(requestId);
    if (!result.ok) {
      setError(result.error ?? "Não foi possível aceitar agora.");
      setLoading(null);
      return;
    }
    onResolved(requestId, "accepted");
  }

  async function handleDecline() {
    setLoading("decline");
    setError(null);
    const result = await declineFriendRequest(requestId);
    if (!result.ok) {
      setError(result.error ?? "Não foi possível recusar agora.");
      setLoading(null);
      return;
    }
    onResolved(requestId, "declined");
  }

  return (
    <div className="flex items-center gap-3 border-b border-edkut-border py-3 last:border-b-0">
      <Link href={`/profile/${fromUser.id}`}>
        <UserAvatar user={fromUser} size="sm" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/profile/${fromUser.id}`} className="font-heading text-sm font-bold text-edkut-blue hover:underline">
          {fromUser.name}
        </Link>
        <p className="truncate text-xs text-edkut-muted">{fromUser.headline}</p>
        {error && (
          <p role="alert" className="mt-1 text-xs text-edkut-pinkDark">
            {error}
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-1.5">
        <button onClick={handleAccept} disabled={loading !== null} className="edkut-btn py-1 text-xs">
          aceitar
        </button>
        <button onClick={handleDecline} disabled={loading !== null} className="edkut-btn-outline py-1 text-xs">
          recusar
        </button>
      </div>
    </div>
  );
}
