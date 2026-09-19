"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { User } from "@/types";
import { Logo } from "./Logo";
import { UserAvatar } from "./Avatar";
import { SearchBar } from "./Search";
import { logout } from "@/lib/session";

interface HeaderProps {
  currentUser: User;
  unreadCount?: number;
}

interface NavItem {
  href: string;
  label: string;
  /** Prefixo usado para decidir o estado "ativo" quando difere do href (ex: perfil). */
  matchPrefix?: string;
}

export function Header({ currentUser, unreadCount = 0 }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  const navItems: NavItem[] = [
    { href: "/home", label: "início" },
    { href: `/profile/${currentUser.id}`, label: "perfil", matchPrefix: "/profile" },
    { href: "/friends", label: "amigos" },
    { href: "/communities", label: "comunidades" },
    { href: "/scraps", label: "scraps" },
    { href: "/testimonials", label: "depoimentos" },
  ];

  function handleLogout() {
    logout();
    router.push("/login");
  }

  function isActive(href: string, matchPrefix?: string) {
    const target = matchPrefix ?? href;
    return pathname === target || pathname.startsWith(`${target}/`);
  }

  return (
    <header className="border-b border-edkut-borderStrong bg-edkut-blueSoft">
      <div className="mx-auto flex max-w-[1080px] flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-1.5 sm:px-4">
        <Link href="/home" aria-label="Ir para o início do EdKut">
          <Logo size="sm" />
        </Link>

        <nav className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-heading font-bold">
          {navItems.map((item, index) => (
            <span key={item.href} className="flex items-center gap-1.5">
              <Link
                href={item.href}
                className={isActive(item.href, item.matchPrefix) ? "text-edkut-pink" : "edkut-link"}
              >
                {item.label}
              </Link>
              {index < navItems.length - 1 && (
                <span className="text-edkut-faint" aria-hidden="true">
                  |
                </span>
              )}
            </span>
          ))}
        </nav>

        <div className="order-last w-full sm:order-none sm:ml-1 sm:w-52">
          <SearchBar />
        </div>

        <div className="ml-auto flex items-center gap-2.5 text-sm">
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
            Olá,{" "}
            <Link href={`/profile/${currentUser.id}`} className="edkut-link font-bold">
              {currentUser.name.split(" ")[0]}
            </Link>
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
