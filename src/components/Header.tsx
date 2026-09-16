"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { User } from "@/types";
import { Logo } from "./Logo";
import { UserAvatar } from "./Avatar";
import { SearchBar } from "./Search";
import { logout } from "@/lib/session";

const NAV_LINKS = [
  { href: "/home", label: "início" },
  { href: "/friends", label: "amigos" },
  { href: "/communities", label: "comunidades" },
  { href: "/scraps", label: "scraps" },
  { href: "/testimonials", label: "depoimentos" },
];

interface HeaderProps {
  currentUser: User;
  unreadCount?: number;
}

export function Header({ currentUser, unreadCount = 0 }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.push("/login");
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="border-b border-edkut-border bg-white">
      <div className="mx-auto flex max-w-[1080px] flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 sm:px-4">
        <Link href="/home" aria-label="Ir para o início do EdKut">
          <Logo size="sm" />
        </Link>

        <nav className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-heading font-bold">
          <Link
            href={`/profile/${currentUser.id}`}
            className={isActive("/profile") ? "text-edkut-pink" : "edkut-link"}
          >
            perfil
          </Link>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={isActive(link.href) ? "text-edkut-pink" : "edkut-link"}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="order-last w-full sm:order-none sm:ml-2 sm:w-56">
          <SearchBar />
        </div>

        <div className="ml-auto flex items-center gap-3 text-sm">
          <Link
            href="/notifications"
            className={`relative font-heading font-bold ${isActive("/notifications") ? "text-edkut-pink" : "edkut-link"}`}
          >
            notificações
            {unreadCount > 0 && (
              <span className="absolute -right-3 -top-2 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-edkut-pink px-1 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </Link>
          <span className="hidden text-edkut-text sm:inline">
            Olá, <Link href={`/profile/${currentUser.id}`} className="edkut-link font-bold">{currentUser.name.split(" ")[0]}</Link>
          </span>
          <UserAvatar user={currentUser} size="xs" />
          <button onClick={handleLogout} className="edkut-pink-link font-heading font-bold">
            sair
          </button>
        </div>
      </div>
    </header>
  );
}
