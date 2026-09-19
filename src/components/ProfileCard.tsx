import Link from "next/link";
import { User } from "@/types";
import { UserAvatar } from "./Avatar";
import { TechProfileIndicators } from "./TechProfileIndicators";
import { USER_TYPE_LABEL } from "@/lib/userType";

/** Card compacto de perfil, usado nas barras laterais (ex: coluna esquerda da Home). */
export function ProfileCard({ user }: { user: User }) {
  return (
    <div className="overflow-hidden rounded-edkut border border-edkut-border bg-white">
      <div className="bg-edkut-blueSoft p-3.5 text-center">
        <Link href={`/profile/${user.id}`} className="inline-block">
          <UserAvatar user={user} size="lg" showOnline />
        </Link>
        <Link href={`/profile/${user.id}`} className="mt-1.5 block font-heading text-base font-bold text-edkut-blue hover:underline">
          {user.name}
        </Link>
        <p className="text-xs font-semibold text-edkut-pink">{USER_TYPE_LABEL[user.userType]}</p>
      </div>

      <div className="flex flex-col gap-2.5 p-3">
        <p className="text-sm text-edkut-text">{user.bio}</p>

        <div className="flex divide-x divide-edkut-border rounded-edkut border border-edkut-border text-center text-xs text-edkut-muted">
          <div className="flex-1 py-1">
            <p className="font-heading text-sm font-bold text-edkut-blue">{user.friendIds.length}</p>
            amigos
          </div>
          <div className="flex-1 py-1">
            <p className="font-heading text-sm font-bold text-edkut-blue">{user.communityIds.length}</p>
            comunidades
          </div>
        </div>

        <TechProfileIndicators scores={user.techProfile} compact />

        <Link href={`/profile/${user.id}`} className="edkut-link text-center text-sm font-semibold">
          ver perfil completo
        </Link>
      </div>
    </div>
  );
}
