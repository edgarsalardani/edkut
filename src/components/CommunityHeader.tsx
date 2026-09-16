"use client";

import { useState } from "react";
import { Community, User } from "@/types";
import { CommunityAvatar } from "./Avatar";

interface CommunityHeaderProps {
  community: Community;
  currentUser: User;
  creator?: User;
}

export function CommunityHeader({ community, currentUser, creator }: CommunityHeaderProps) {
  const [joined, setJoined] = useState(community.memberIds.includes(currentUser.id));
  const [memberCount, setMemberCount] = useState(community.memberCount);

  function handleToggleJoin() {
    setJoined((j) => !j);
    setMemberCount((count) => (joined ? count - 1 : count + 1));
  }

  return (
    <div className="edkut-card overflow-hidden">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
        <CommunityAvatar community={community} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-edkut-pink">{community.category}</p>
          <h1 className="font-heading text-xl font-bold text-edkut-blue">{community.name}</h1>
          <p className="mt-1 text-sm text-edkut-text">{community.longDescription ?? community.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-edkut-muted">
            <span>{memberCount.toLocaleString("pt-BR")} membros</span>
            {creator && <span>criada por {creator.name}</span>}
          </div>
        </div>
        <button onClick={handleToggleJoin} className={joined ? "edkut-btn-outline whitespace-nowrap" : "edkut-btn-pink whitespace-nowrap"}>
          {joined ? "sair da comunidade" : "entrar na comunidade"}
        </button>
      </div>
    </div>
  );
}
