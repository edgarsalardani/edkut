import { Comment as CommentType, User } from "@/types";
import { UserAvatar } from "./Avatar";
import { formatRelativeTime } from "@/lib/format";
import Link from "next/link";

export function Comment({ comment, author }: { comment: CommentType; author?: User }) {
  if (!author) return null;

  return (
    <div className="flex gap-2 py-1.5">
      <Link href={`/profile/${author.id}`}>
        <UserAvatar user={author} size="xs" />
      </Link>
      <div className="min-w-0 flex-1 rounded-edkut bg-edkut-blueSoft px-2.5 py-1.5">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <Link href={`/profile/${author.id}`} className="text-xs font-bold text-edkut-blue hover:underline">
            {author.name}
          </Link>
          <span className="text-[11px] text-edkut-faint">{formatRelativeTime(comment.createdAt)}</span>
        </div>
        <p className="text-sm text-edkut-text">{comment.text}</p>
      </div>
    </div>
  );
}
