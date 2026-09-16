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
  size?: keyof typeof SIZE_MAP;
  online?: boolean;
  className?: string;
}

/**
 * O EdKut não usa fotos reais de terceiros nem assets externos: cada usuário
 * e comunidade tem um emoji + cor de destaque, funcionando como "foto" leve
 * do protótipo (fácil de trocar por upload de imagem real no futuro).
 */
export function Avatar({ emoji, color, size = "md", online, className = "" }: AvatarProps) {
  return (
    <span className={`relative inline-flex shrink-0 ${className}`}>
      <span
        className={`flex items-center justify-center rounded-edkut border border-edkut-border ${SIZE_MAP[size]}`}
        style={{ backgroundColor: `${color}1A` }}
      >
        <span aria-hidden="true">{emoji}</span>
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
