"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { User } from "@/types";
import { UserAvatar } from "@/components/Avatar";
import { FriendRequestCard } from "@/components/FriendRequestCard";
import { PendingRequestWithUser } from "@/services/friendService";

interface FriendsPageClientProps {
  initialFriends: User[];
  initialRequests: PendingRequestWithUser[];
}

export function FriendsPageClient({ initialFriends, initialRequests }: FriendsPageClientProps) {
  const [friends, setFriends] = useState(initialFriends);
  const [requests, setRequests] = useState(initialRequests);
  const [query, setQuery] = useState("");

  const filteredFriends = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(
      (f) => f.name.toLowerCase().includes(q) || f.interests.some((i) => i.toLowerCase().includes(q))
    );
  }, [friends, query]);

  function handleResolved(requestId: string, status: "accepted" | "declined") {
    const request = requests.find((r) => r.id === requestId);
    setRequests((prev) => prev.filter((r) => r.id !== requestId));
    if (status === "accepted" && request) {
      setFriends((prev) => (prev.some((f) => f.id === request.fromUser.id) ? prev : [request.fromUser, ...prev]));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {requests.length > 0 && (
        <div className="edkut-card">
          <div className="edkut-card-title">solicitações de amizade ({requests.length})</div>
          <div className="px-3.5">
            {requests.map((request) => (
              <FriendRequestCard
                key={request.id}
                requestId={request.id}
                fromUser={request.fromUser}
                onResolved={handleResolved}
              />
            ))}
          </div>
        </div>
      )}

      <div className="edkut-card p-3.5">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="pesquisar amigos por nome ou interesse..."
          className="edkut-input"
          aria-label="Pesquisar amigos"
        />
      </div>

      <div className="edkut-card p-3.5">
        <h2 className="mb-3 font-heading text-sm font-bold text-edkut-blue">
          meus amigos ({filteredFriends.length})
        </h2>

        {filteredFriends.length === 0 ? (
          <p className="text-sm text-edkut-muted">Nenhum amigo encontrado.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {filteredFriends.map((friend) => (
              <Link
                key={friend.id}
                href={`/profile/${friend.id}`}
                className="flex flex-col items-center gap-1.5 rounded-edkut border border-edkut-border p-3 text-center hover:border-edkut-pink hover:bg-edkut-blueSoft"
              >
                <UserAvatar user={friend} size="md" showOnline />
                <span className="line-clamp-1 text-sm font-bold text-edkut-blue">{friend.name}</span>
                <span className="line-clamp-1 text-xs text-edkut-muted">{friend.headline}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
