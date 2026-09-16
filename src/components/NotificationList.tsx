import Link from "next/link";
import { AppNotification, NotificationKind } from "@/types";
import { getUserById } from "@/mocks/users";
import { UserAvatar, Avatar } from "./Avatar";
import { formatRelativeTime } from "@/lib/format";

const KIND_ICON: Record<NotificationKind, string> = {
  friend_accept: "🤝",
  friend_request: "➕",
  comment: "💬",
  scrap: "📝",
  testimonial: "⭐",
  community_post: "📣",
};

function targetHref(notification: AppNotification): string | undefined {
  switch (notification.kind) {
    case "comment":
      return undefined; // posts do feed não têm página própria na V1
    case "community_post":
      return notification.targetId ? `/communities/${notification.targetId}` : undefined;
    case "friend_accept":
    case "friend_request":
      return notification.actorId ? `/profile/${notification.actorId}` : "/friends";
    case "scrap":
      return "/scraps";
    case "testimonial":
      return "/testimonials";
    default:
      return undefined;
  }
}

export function NotificationList({ notifications }: { notifications: AppNotification[] }) {
  if (notifications.length === 0) {
    return (
      <div className="edkut-card p-6 text-center text-sm text-edkut-muted">
        Nenhuma notificação por enquanto. Quando algo acontecer por aqui, você vê primeiro.
      </div>
    );
  }

  return (
    <div className="edkut-card divide-y divide-edkut-border">
      {notifications.map((notification) => {
        const actor = notification.actorId ? getUserById(notification.actorId) : undefined;
        const href = targetHref(notification);
        const content = (
          <div
            className={`flex items-start gap-3 px-3.5 py-3 ${notification.read ? "" : "bg-edkut-blueSoft"} ${href ? "hover:bg-edkut-bgAlt" : ""}`}
          >
            {actor ? (
              <UserAvatar user={actor} size="xs" />
            ) : (
              <Avatar emoji={KIND_ICON[notification.kind]} color="#1D4E89" size="xs" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm text-edkut-text">
                <span aria-hidden="true">{KIND_ICON[notification.kind]}</span> {notification.message}
              </p>
              <p className="text-xs text-edkut-faint">{formatRelativeTime(notification.createdAt)}</p>
            </div>
            {!notification.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-edkut-pink" aria-label="não lida" />}
          </div>
        );

        return (
          <div key={notification.id}>
            {href ? <Link href={href}>{content}</Link> : content}
          </div>
        );
      })}
    </div>
  );
}
