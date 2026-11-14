"use client";

import { useEffect, useState } from "react";
import { User, Community } from "@/types";

const SIZE_MAP = {
  xs: "h-6 w-6 text-xs",
  sm: "h-9 w-9 text-base",
  md: "h-12 w-12 text-xl",
  lg: "h-20 w-20 text-3xl",
  xl: "h-28 w-28 text-5xl",
} as const;

interface AvatarProps {
  emoji: string;
  color: string;
  /** Foto enviada pelo usuário. Se ausente (ou falhar ao carregar), mostra o avatar padrão (emoji + cor). */
  imageUrl?: string;
  size?: keyof typeof SIZE_MAP;
  online?: boolean;
  className?: string;
}

/**
 * Cada usuário e comunidade tem um emoji + cor de destaque (avatar padrão).
 * Usuários que enviaram foto (Supabase Storage) mostram a imagem no mesmo quadro;
 * se a imagem não carregar, volta ao avatar padrão.
 */
export function Avatar({ emoji, color, imageUrl, size = "md", online, className = "" }: AvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  // Nova URL (ex.: depois de trocar a foto) => tenta de novo.
  useEffect(() => setImageFailed(false), [imageUrl]);
  const showImage = !!imageUrl && !imageFailed;

  return (
    <span className={`relative inline-flex shrink-0 ${className}`}>
      <span
        className={`flex items-center justify-center overflow-hidden rounded-edkut border border-edkut-border ${SIZE_MAP[size]}`}
        style={{ backgroundColor: `${color}1A` }}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span aria-hidden="true">{emoji}</span>
        )}
      </span>
      {online && (
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-edkut-green" />
      )}
    </span>
  );
}

export function UserAvatar({
  user,
  size = "md",
  showOnline = false,
}: {
  user: User;
  size?: keyof typeof SIZE_MAP;
  showOnline?: boolean;
}) {
  return (
    <Avatar
      emoji={user.avatarEmoji}
      color={user.avatarColor}
      imageUrl={user.avatarUrl}
      size={size}
      online={showOnline ? user.online : undefined}
    />
  );
}

export function CommunityAvatar({
  community,
  size = "md",
}: {
  community: Community;
  size?: keyof typeof SIZE_MAP;
}) {
  return <Avatar emoji={community.emoji} color={community.color} size={size} />;
}
