import Link from "next/link";
import { UserAvatar } from "./Avatar";
import { ClassicIndicators } from "./ClassicIndicators";
import { EmoticonText } from "./Emoticon";
import { FriendGrid } from "./FriendGrid";
import { ProfileCommunitiesBox } from "./ProfileCommunitiesBox";
import { USER_TYPE_LABEL } from "@/lib/userType";
import { formatRelativeTime } from "@/lib/format";
import type { HomeData } from "@/services/homeService";
import type { User } from "@/types";

interface HomeClassicViewProps {
  currentUser: User;
  friends: User[];
  data: HomeData;
}

/**
 * Home no estilo do perfil clássico (3 colunas). Componente de APRESENTAÇÃO: só mostra dados reais que a página
 * (servidor) já buscou. Reaproveita os mesmos componentes do perfil (avatar, indicadores, quadro de amigos e de
 * comunidades). O menu vertical leva às páginas próprias (Recados, Depoimentos, Amigos, Comunidades) e às abas
 * Fotos/Vídeos do perfil (?aba=).
 */
export function HomeClassicView({ currentUser, friends, data }: HomeClassicViewProps) {
  const { summary, recentScraps, pendingRequests, pendingTestimonials } = data;
  const firstName = currentUser.name.split(" ")[0];
  const status = summary.extras.statusPhrase;
  const profileHref = `/profile/${currentUser.id}`;
  const n = (v: number | null) => (v === null ? "–" : String(v));

  const menu: { href: string; label: string; icon: string; count?: string }[] = [
    { href: profileHref, label: "perfil", icon: "👤" },
    { href: "/scraps", label: "recados", icon: "✉️", count: summary.counts.scraps === null ? undefined : String(summary.counts.scraps) },
    { href: `${profileHref}?aba=fotos`, label: "fotos", icon: "📷", count: summary.counts.photos === null ? undefined : String(summary.counts.photos) },
    { href: `${profileHref}?aba=videos`, label: "vídeos", icon: "🎬", count: summary.counts.videos === null ? undefined : String(summary.counts.videos) },
    { href: "/testimonials", label: "depoimentos", icon: "💬", count: pendingTestimonials ? `${pendingTestimonials} novo${pendingTestimonials === 1 ? "" : "s"}` : undefined },
    { href: "/friends", label: "amigos", icon: "👥", count: String(currentUser.friendIds.length) },
    { href: "/communities", label: "comunidades", icon: "🏘️", count: summary.counts.communities === null ? undefined : String(summary.counts.communities) },
  ];

  const shortcuts: { href: string; icon: string; text: string; badge?: number | null; highlight: boolean }[] = [
    {
      href: "/scraps",
      icon: "✉️",
      text: summary.counts.scraps === null ? "Veja seus recados" : summary.counts.scraps === 0 ? "Você ainda não recebeu recados" : `${summary.counts.scraps} ${summary.counts.scraps === 1 ? "recado" : "recados"} no seu perfil`,
      highlight: false,
    },
    {
      href: "/testimonials",
      icon: "💬",
      text: pendingTestimonials ? `${pendingTestimonials} ${pendingTestimonials === 1 ? "depoimento aguarda" : "depoimentos aguardam"} a sua aprovação` : "Veja seus depoimentos",
      highlight: Boolean(pendingTestimonials),
    },
    {
      href: "/friends",
      icon: "🤝",
      text: pendingRequests.length > 0 ? `${pendingRequests.length} ${pendingRequests.length === 1 ? "solicitação de amizade pendente" : "solicitações de amizade pendentes"}` : "Seus amigos e solicitações",
      highlight: pendingRequests.length > 0,
    },
    { href: "/communities", icon: "🏘️", text: `Suas comunidades (${n(summary.counts.communities)})`, highlight: false },
    { href: "/search", icon: "🔎", text: "Encontrar pessoas", highlight: false },
  ];

  const menuItemClass = "flex items-center gap-2 px-3 py-2 text-left text-sm font-heading font-bold edkut-link";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[190px_minmax(0,1fr)_250px]" data-testid="home-layout">
      {/* Coluna esquerda — identidade e menu */}
      <aside className="flex flex-col gap-3 lg:order-1" aria-label="Identidade e menu">
        <div className="rounded-edkut border border-edkut-border bg-white">
          <div className="flex flex-col items-center gap-1.5 p-3 text-center">
            <Link href={profileHref} aria-label="Ver meu perfil">
              <UserAvatar user={currentUser} size="2xl" />
            </Link>
            <Link href={profileHref} className="[overflow-wrap:anywhere] font-heading text-sm font-bold text-edkut-blue hover:underline">
              {currentUser.name}
            </Link>
            <p className="text-xs font-semibold text-edkut-pink">{USER_TYPE_LABEL[currentUser.userType]}</p>
            {status ? (
              <p className="[overflow-wrap:anywhere] text-xs italic text-edkut-text" data-testid="home-status">“{status}”</p>
            ) : (
              !summary.migrationMissing && (
                <Link href="/profile/edit" className="edkut-link text-[11px] font-semibold" data-testid="home-status-invite">
                  escreva uma frase de status
                </Link>
              )
            )}
          </div>
          <div className="border-t border-edkut-border p-2">
            <ClassicIndicators
              stacked
              scores={currentUser.techProfile}
              ratingsCount={currentUser.ratingsCount ?? 0}
              fanCount={summary.counts.fans}
              iAmFan={false}
              canToggleFan={false}
            />
          </div>
          <nav aria-label="Menu" className="grid grid-cols-2 divide-y divide-edkut-border border-t border-edkut-border sm:grid-cols-3 lg:flex lg:flex-col" data-testid="home-menu">
            {menu.map((item) => (
              <Link key={item.label} href={item.href} className={menuItemClass}>
                <span aria-hidden>{item.icon}</span>
                {item.label}
                {item.count && <span className="font-normal text-edkut-muted">({item.count})</span>}
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      {/* Coluna central — boas-vindas e atividades reais */}
      <section className="flex min-w-0 flex-col gap-3 lg:order-2" aria-label="Página inicial">
        <div className="rounded-edkut border border-edkut-border bg-white px-3.5 py-3">
          <h1 className="[overflow-wrap:anywhere] font-heading text-xl font-bold text-edkut-blue">
            Olá, {firstName}! <span className="text-base font-normal text-edkut-muted">que bom ter você no edkut.</span>
          </h1>
        </div>

        {summary.migrationMissing && (
          <p role="alert" className="rounded-edkut border border-edkut-pink bg-edkut-pinkSoft px-3 py-2 text-xs text-edkut-pinkDark">
            Alguns recursos do perfil (status, fotos, vídeos, fãs) precisam da migração 14 no Supabase. Aplique-a e atualize a página.
          </p>
        )}

        <div className="edkut-card" data-testid="home-shortcuts">
          <div className="edkut-card-title">atalhos</div>
          <ul className="divide-y divide-edkut-border">
            {shortcuts.map((s, i) => (
              <li key={s.href} className={i % 2 === 0 ? "bg-white" : "bg-edkut-blueSoft"}>
                <Link href={s.href} className={`flex items-center gap-2 px-3.5 py-2 text-sm hover:underline ${s.highlight ? "font-bold text-edkut-pink" : "edkut-link font-semibold"}`}>
                  <span aria-hidden>{s.icon}</span>
                  <span className="min-w-0 break-words">{s.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {pendingRequests.length > 0 && (
          <div className="edkut-card" data-testid="home-requests">
            <div className="edkut-card-title">solicitações de amizade ({pendingRequests.length})</div>
            <ul className="flex flex-wrap gap-3 p-3">
              {pendingRequests.slice(0, 3).map((r) => (
                <li key={r.id}>
                  <Link href={`/profile/${r.fromUser.id}`} className="flex w-20 flex-col items-center gap-1 text-center hover:underline">
                    <UserAvatar user={r.fromUser} size="sm" />
                    <span className="line-clamp-1 w-full text-xs font-semibold text-edkut-blue">{r.fromUser.name.split(" ")[0]}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="border-t border-edkut-border px-3.5 py-1.5 text-right">
              <Link href="/friends" className="edkut-link text-xs font-semibold">aceitar ou recusar</Link>
            </div>
          </div>
        )}

        <div className="edkut-card" data-testid="home-scraps">
          <div className="edkut-card-title">últimos recados</div>
          {recentScraps.length === 0 ? (
            <p className="px-3.5 py-3 text-sm text-edkut-muted">Você ainda não recebeu recados.</p>
          ) : (
            <ul className="divide-y divide-edkut-border">
              {recentScraps.map(({ scrap, author }, i) => (
                <li key={scrap.id} className={`flex gap-2.5 px-3.5 py-2 ${i % 2 === 0 ? "bg-white" : "bg-edkut-blueSoft"}`}>
                  {author ? (
                    <Link href={`/profile/${author.id}`} className="shrink-0">
                      <UserAvatar user={author} size="xs" />
                    </Link>
                  ) : (
                    <span className="h-6 w-6 shrink-0" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-edkut-muted">
                      {author ? (
                        <Link href={`/profile/${author.id}`} className="edkut-link font-bold">{author.name}</Link>
                      ) : (
                        <span className="font-bold">Alguém</span>
                      )}{" "}
                      · {formatRelativeTime(scrap.createdAt)}
                    </p>
                    <p className="line-clamp-2 break-words text-sm text-edkut-text"><EmoticonText text={scrap.message} /></p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-edkut-border px-3.5 py-1.5 text-right">
            <Link href="/scraps" className="edkut-link text-xs font-semibold">ver todos os recados</Link>
          </div>
        </div>

        <div className="rounded-edkut border border-dashed border-edkut-border bg-white px-3.5 py-2.5 text-xs text-edkut-muted" data-testid="home-feed-empty">
          <span className="font-heading font-bold text-edkut-blue">publicações dos amigos</span> — ainda não estão disponíveis nesta versão do edkut.
        </div>
      </section>

      {/* Coluna direita — conexões sociais (mesmos quadros do perfil) */}
      <aside className="flex flex-col gap-3 lg:order-3" aria-label="Amigos e comunidades">
        <FriendGrid
          friends={friends.slice(0, 9)}
          title={`amigos (${currentUser.friendIds.length})`}
          viewAllHref="/friends"
          columns={3}
          emptyMessage="Você ainda não tem amigos."
          emptyAction={{ href: "/search", label: "buscar pessoas" }}
        />
        <ProfileCommunitiesBox
          communities={summary.communities}
          total={summary.counts.communities}
          viewAllHref="/communities"
          emptyMessage="Você ainda não participa de comunidades."
          emptyAction={{ href: "/communities", label: "ver comunidades" }}
        />
      </aside>
    </div>
  );
}
