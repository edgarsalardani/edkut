import Link from "next/link";
import { Testimonial, User } from "@/types";
import { UserAvatar } from "./Avatar";
import { formatRelativeTime } from "@/lib/format";

export function TestimonialCard({ testimonial, author }: { testimonial: Testimonial; author?: User }) {
  if (!author) return null;

  return (
    <div className="flex gap-2.5 border-b border-edkut-border py-3 last:border-b-0">
      <Link href={`/profile/${author.id}`}>
        <UserAvatar user={author} size="sm" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <Link href={`/profile/${author.id}`} className="font-heading text-sm font-bold text-edkut-blue hover:underline">
            {author.name}
          </Link>
          <span className="text-xs text-edkut-faint">{formatRelativeTime(testimonial.createdAt)}</span>
        </div>
        <p className="mt-0.5 text-sm italic text-edkut-text">&ldquo;{testimonial.message}&rdquo;</p>
      </div>
    </div>
  );
}
