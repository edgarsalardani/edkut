"use client";

import Link from "next/link";
import { User } from "@/types";
import { UserAvatar } from "./Avatar";
import { FriendshipButton } from "./FriendshipButton";
import { USER_TYPE_LABEL } from "@/lib/userType";
import type { FriendshipState } from "@/services/socialService";

/**
 * Uma pessoa nos resultados da busca: foto, nome e @username (links para o perfil real) + a ação de amizade
 * (adicionar / solicitação enviada / aceitar / amigos), a mesma usada no perfil.
 */
export function PersonResultCard({
  person,
  friendship,
  currentUserId,
  isLast,
}: {
  person: User;
  friendship: FriendshipState;
  currentUserId: string;
  isLast: boolean;
}) {
  return (
    <li className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3 ${isLast ? "" : "border-b border-edkut-border"}`}>
      <Link href={`/profile/${person.id}`} className="shrink-0" aria-label={`Ver perfil de ${person.name}`}>
        <UserAvatar user={person} size="md" />
      </Link>

      <div className="min-w-0 flex-1 basis-40">
        <Link href={`/profile/${person.id}`} className="block truncate font-heading text-sm font-bold text-edkut-blue hover:underline">
          {person.name}
        </Link>
        <p className="truncate text-xs text-edkut-muted">@{person.username}</p>
        <p className="truncate text-xs text-edkut-text">
          <span className="font-semibold text-edkut-pink">{USER_TYPE_LABEL[person.userType]}</span>
          {person.headline ? ` · ${person.headline}` : ""}
        </p>
      </div>

      <div className="w-full shrink-0 sm:w-auto">
        <FriendshipButton currentUserId={currentUserId} profileId={person.id} initial={friendship} compact />
      </div>
    </li>
  );
}
