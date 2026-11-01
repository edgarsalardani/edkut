import Link from "next/link";
import { User } from "@/types";
import { UserAvatar } from "./Avatar";

interface FriendGridProps {
  friends: User[];
  title?: string;
  viewAllHref?: string;
  emptyMessage?: string;
  columns?: 2 | 3 | 4;
}

export function FriendGrid({
  friends,
  title,
  viewAllHref,
  emptyMessage = "Nenhum amigo por aqui ainda.",
  columns = 3,
}: FriendGridProps) {
  const colsClass = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" }[columns];

  return (
    <div className="edkut-card p-3">
      {title && (
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-heading text-sm font-bold text-edkut-blue">{title}</h3>
          {viewAllHref && (
            <Link href={viewAllHref} className="edkut-link text-xs font-semibold">
              ver todos
            </Link>
          )}
        </div>
      )}

      {friends.length === 0 ? (
        <p className="text-sm text-edkut-muted">{emptyMessage}</p>
      ) : (
        <div className={`grid ${colsClass} gap-2`}>
          {friends.map((friend) => (
            <Link
              key={friend.id}
              href={`/profile/${friend.id}`}
              className="flex flex-col items-center gap-1 rounded-edkut p-1.5 text-center hover:bg-edkut-blueSoft"
            >
              <UserAvatar user={friend} size="sm" />
              <span className="line-clamp-1 text-xs font-semibold text-edkut-blue">
                {friend.name.split(" ")[0]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
