"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { ProfilePhoto, ProfileVideo, Scrap, Testimonial, User } from "@/types";
import { UserAvatar } from "./Avatar";
import { ProfileAvatarEditor } from "./ProfileAvatarEditor";
import { Tag } from "./Tag";
import { ClassicIndicators } from "./ClassicIndicators";
import { ProfileStatusEditor } from "./ProfileStatusEditor";
import { ProfilePhotosSection } from "./ProfilePhotosSection";
import { ProfileVideosSection } from "./ProfileVideosSection";
import { ProfileCommunitiesBox } from "./ProfileCommunitiesBox";
import { FriendGrid } from "./FriendGrid";
import { ProfileScrapsSection } from "./ProfileScrapsSection";
import { ProfileTestimonialsSection } from "./ProfileTestimonialsSection";
import { ProfileApprovedTestimonials } from "./ProfileApprovedTestimonials";
import { FriendshipButton } from "./FriendshipButton";
import { FriendRatingPanel } from "./FriendRatingPanel";
import { fetchProfileScores, type MyRating } from "@/lib/ratings";
import type { FriendshipState } from "@/services/socialService";
import type { ScrapsData } from "@/services/scrapService";
import type { TestimonialsData } from "@/services/testimonialService";
import { USER_TYPE_LABEL } from "@/lib/userType";
import type { ProfileClassicData } from "@/services/profileClassicService";
import { buildInfoRows, type ProfileTab } from "@/lib/profileClassic";
import { setFan } from "@/lib/profileExtras";

// A aba "publicações" volta quando as publicações forem integradas ao Supabase.
type Tab = ProfileTab;

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "perfil", label: "perfil", icon: "👤" },
  { id: "recados", label: "recados", icon: "✉️" },
  { id: "fotos", label: "fotos", icon: "📷" },
  { id: "videos", label: "vídeos", icon: "🎬" },
  { id: "depoimentos", label: "depoimentos", icon: "💬" },
];

const TECH_LEGEND: { label: string; color: string; description: string }[] = [
  { label: "PARCEIRO", color: "#3FA66B", description: "o quanto a pessoa é vista como colaborativa e disposta a ajudar (carinhas)" },
  { label: "NERD", color: "#D81B85", description: "a identificação da pessoa com a cultura de Computação e Tecnologia (cubinhos)" },
  { label: "TECH", color: "#1D4E89", description: "o quanto a pessoa é vista como ligada ao universo da tecnologia (corações)" },
];

const DEFAULT_CLASSIC: ProfileClassicData = {
  extras: {},
  counts: { scraps: null, photos: null, videos: null, fans: null, communities: null },
  photos: [],
  videos: [],
  iAmFan: false,
  communities: [],
  migrationMissing: false,
  error: false,
};

interface ProfilePageClientProps {
  profileUser: User;
  currentUser: User;
  isOwnProfile: boolean;
  /** Relação REAL com o perfil (amigos, solicitação enviada/recebida ou nenhuma). */
  friendship: FriendshipState;
  /** Minha avaliação atual sobre este perfil (só quando somos amigos). */
  myRating: MyRating | null;
  friends: User[];
  scrapsData: ScrapsData;
  testimonialsData: TestimonialsData;
  /** Status, dados pessoais, contadores, fotos, vídeos, fãs e comunidades (migração 14). */
  classic?: ProfileClassicData;
  /** Aba aberta ao carregar (vem de ?aba= na URL; usada pelos atalhos da Home). */
  initialTab?: Tab;
}

export function ProfilePageClient({
  profileUser,
  currentUser,
  isOwnProfile,
  friendship,
  myRating,
  friends,
  scrapsData,
  testimonialsData,
  classic = DEFAULT_CLASSIC,
  initialTab = "perfil",
}: ProfilePageClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const firstName = profileUser.name.split(" ")[0];

  const [friendshipState, setFriendshipState] = useState<FriendshipState>(friendship);
  const [scores, setScores] = useState(profileUser.techProfile);
  const [ratingsCount, setRatingsCount] = useState<number | undefined>(profileUser.ratingsCount ?? 0);

  // Rebusca os percentuais consolidados (média calculada pelo banco) sem recarregar a página.
  const refreshScores = useCallback(async () => {
    const snapshot = await fetchProfileScores(profileUser.id);
    if (snapshot) {
      setScores(snapshot.scores);
      setRatingsCount(snapshot.ratingsCount);
    }
  }, [profileUser.id]);

  const canRate = !isOwnProfile && friendshipState.status === "friends";

  // Scraps e depoimentos ficam aqui (e não dentro das abas) para sobreviverem à troca de aba e
  // para o perfil mostrar os depoimentos aprovados sem nova leitura no servidor.
  const [scrapItems, setScrapItems] = useState<Scrap[]>(scrapsData.scraps);
  const [scrapAuthors, setScrapAuthors] = useState<User[]>(scrapsData.authors);
  const [testimonialItems, setTestimonialItems] = useState<Testimonial[]>(testimonialsData.testimonials);
  const [testimonialAuthors, setTestimonialAuthors] = useState<User[]>(testimonialsData.authors);
  const handleScrapsChange = useCallback((items: Scrap[], authors: User[]) => {
    setScrapItems(items);
    setScrapAuthors(authors);
  }, []);
  const handleTestimonialsChange = useCallback((items: Testimonial[], authors: User[]) => {
    setTestimonialItems(items);
    setTestimonialAuthors(authors);
  }, []);

  // Depoimentos aguardando aprovação (só o dono do perfil enxerga): destaca o item do menu para ele não perder nenhum.
  const [pendingTestimonials, setPendingTestimonials] = useState(
    isOwnProfile ? testimonialsData.testimonials.filter((t) => t.status === "pending").length : 0
  );

  // ----- perfil clássico: status, fotos, vídeos, fãs -----
  const [statusPhrase, setStatusPhrase] = useState<string | undefined>(classic.extras.statusPhrase);
  const [photos, setPhotos] = useState<ProfilePhoto[]>(classic.photos);
  const [photosTotal, setPhotosTotal] = useState<number | null>(classic.counts.photos);
  const [videos, setVideos] = useState<ProfileVideo[]>(classic.videos);
  const [videosTotal, setVideosTotal] = useState<number | null>(classic.counts.videos);
  const [iAmFan, setIAmFan] = useState(classic.iAmFan);
  const [fanCount, setFanCount] = useState<number | null>(classic.counts.fans);
  const [fanBusy, setFanBusy] = useState(false);
  const [fanError, setFanError] = useState<string | null>(null);

  // Recados: contador do servidor + variação local (novos recados enviados/apagados nesta tela).
  const rootScraps = (items: Scrap[]) => items.filter((s) => !s.parentId).length;
  const initialRoots = useRef(rootScraps(scrapsData.scraps)).current;
  const scrapsTotal = classic.counts.scraps === null ? null : Math.max(0, classic.counts.scraps + rootScraps(scrapItems) - initialRoots);

  const countOf = (t: Tab): string | null => {
    if (t === "recados") return scrapsTotal === null ? null : String(scrapsTotal);
    if (t === "fotos") return photosTotal === null ? null : String(photosTotal);
    if (t === "videos") return videosTotal === null ? null : String(videosTotal);
    if (t === "depoimentos" && isOwnProfile && pendingTestimonials > 0) return `${pendingTestimonials} novo${pendingTestimonials === 1 ? "" : "s"}`;
    return null;
  };
  const tabLabel = (t: { id: Tab; label: string }) => {
    const c = countOf(t.id);
    return c === null ? t.label : `${t.label} (${c})`;
  };

  function handleFriendshipChange(next: FriendshipState) {
    setFriendshipState(next);
    // Amizade desfeita/criada muda quais votos valem: atualiza as barras.
    void refreshScores();
  }

  async function handleToggleFan() {
    if (fanBusy || isOwnProfile) return;
    setFanBusy(true);
    setFanError(null);
    const next = !iAmFan;
    const result = await setFan(currentUser.id, profileUser.id, next);
    setFanBusy(false);
    if (!result.ok) {
      setFanError(result.error ?? "Não foi possível atualizar.");
      return;
    }
    setIAmFan(next);
    setFanCount((n) => (n === null ? n : Math.max(0, n + (next ? 1 : -1))));
  }

  const infoRows = buildInfoRows({
    extras: { ...classic.extras, statusPhrase },
    userTypeLabel: USER_TYPE_LABEL[profileUser.userType],
    location: profileUser.location,
    bio: profileUser.bio,
    interests: profileUser.interests,
    institution: profileUser.institution,
    courseOrArea: profileUser.courseOrArea,
    joinedAt: profileUser.joinedAt,
  });

  const friendsHref = isOwnProfile ? "/friends" : `/profile/${profileUser.id}/friends`;
  const communitiesHref = `/profile/${profileUser.id}/communities`;
  const menuItemClass = (active: boolean) =>
    `flex items-center gap-2 px-3 py-2 text-left text-sm font-heading font-bold ${active ? "bg-edkut-blueSoft text-edkut-pink" : "edkut-link"}`;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[190px_minmax(0,1fr)_250px]" data-testid="profile-layout">
      {/* Coluna esquerda — identidade e menu */}
      <aside className="flex flex-col gap-3 lg:order-1" aria-label="Identidade e menu do perfil">
        <div className="rounded-edkut border border-edkut-border bg-white">
          <div className="flex flex-col items-center gap-1.5 p-3 text-center">
            {isOwnProfile ? <ProfileAvatarEditor user={profileUser} size="2xl" /> : <UserAvatar user={profileUser} size="2xl" />}
            <p className="break-words font-heading text-sm font-bold text-edkut-blue">{profileUser.name}</p>
            <p className="text-xs font-semibold text-edkut-pink">{USER_TYPE_LABEL[profileUser.userType]}</p>
            {profileUser.headline && <p className="break-words text-[11px] text-edkut-muted">{profileUser.headline}</p>}
            {profileUser.location && <p className="break-words text-[11px] text-edkut-faint">📍 {profileUser.location}</p>}

            {isOwnProfile ? (
              <>
                <span className="edkut-tag" data-testid="own-badge">este é o seu perfil</span>
                <Link href="/profile/edit" className="edkut-btn-outline w-full text-center">
                  editar perfil
                </Link>
              </>
            ) : (
              <FriendshipButton currentUserId={currentUser.id} profileId={profileUser.id} initial={friendship} onChange={handleFriendshipChange} />
            )}
          </div>

          <nav aria-label="Seções do perfil" className="hidden border-t border-edkut-border lg:flex lg:flex-col lg:divide-y lg:divide-edkut-border">
            {TABS.map((t) => (
              <button key={t.id} type="button" onClick={() => setActiveTab(t.id)} aria-current={activeTab === t.id ? "page" : undefined} className={menuItemClass(activeTab === t.id)}>
                <span aria-hidden>{t.icon}</span>
                {tabLabel(t)}
              </button>
            ))}
            <Link href={friendsHref} className={menuItemClass(false)}>
              <span aria-hidden>👥</span>
              amigos ({profileUser.friendIds.length})
            </Link>
            <Link href={communitiesHref} className={menuItemClass(false)}>
              <span aria-hidden>🏘️</span>
              comunidades{classic.counts.communities !== null ? ` (${classic.counts.communities})` : ""}
            </Link>
          </nav>
        </div>
      </aside>

      {/* Coluna central — página pessoal */}
      <section className="flex min-w-0 flex-col gap-3 lg:order-2">
        <div className="flex flex-col gap-2 rounded-edkut border border-edkut-border bg-white p-3.5">
          <div>
            <h1 className="break-words font-heading text-xl font-bold text-edkut-blue">{profileUser.name}</h1>
            <ProfileStatusEditor userId={profileUser.id} value={statusPhrase} isOwnProfile={isOwnProfile} disabled={classic.migrationMissing} onChange={setStatusPhrase} />
          </div>

          {isOwnProfile && classic.migrationMissing && (
            <p role="alert" className="rounded-edkut border border-edkut-pink bg-edkut-pinkSoft px-3 py-2 text-xs text-edkut-pinkDark">
              Alguns recursos novos do perfil (status, fotos, vídeos, fãs) precisam da migração 14 no Supabase. Aplique-a e atualize a página.
            </p>
          )}

          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-edkut-muted" aria-label="Contadores do perfil" data-testid="counters">
            {(
              [
                ["recados", scrapsTotal, "recados"],
                ["fotos", photosTotal, "fotos"],
                ["vídeos", videosTotal, "videos"],
              ] as const
            ).map(([label, n, tab]) => (
              <li key={label}>
                <button type="button" className="hover:underline" onClick={() => setActiveTab(tab)}>
                  <span className="font-heading text-sm font-bold text-edkut-blue">{n ?? "–"}</span> {label}
                </button>
              </li>
            ))}
            <li>
              <span className="font-heading text-sm font-bold text-edkut-blue">{fanCount ?? "–"}</span> {fanCount === 1 ? "fã" : "fãs"}
            </li>
          </ul>

          <ClassicIndicators
            scores={scores}
            ratingsCount={ratingsCount}
            fanCount={fanCount}
            iAmFan={iAmFan}
            canToggleFan={!isOwnProfile && !classic.migrationMissing}
            fanBusy={fanBusy}
            fanError={fanError}
            onToggleFan={() => void handleToggleFan()}
          />
        </div>

        {canRate && (
          <FriendRatingPanel
            key={`${profileUser.id}-${myRating?.isCurrent ?? "none"}`}
            ratedId={profileUser.id}
            firstName={firstName}
            initialRating={myRating}
            onSaved={refreshScores}
          />
        )}

        <div className="rounded-edkut border border-edkut-border bg-white">
          <div role="tablist" aria-label="Seções" className="flex overflow-x-auto border-b border-edkut-border text-sm font-heading font-bold lg:hidden">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={activeTab === t.id}
                onClick={() => setActiveTab(t.id)}
                className={`shrink-0 px-3 py-2 text-center ${activeTab === t.id ? "border-b-2 border-edkut-pink text-edkut-pink" : "text-edkut-muted hover:text-edkut-blue"}`}
              >
                {tabLabel(t)}
              </button>
            ))}
          </div>

          <div className="p-3.5">
            {activeTab === "perfil" && (
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="border-b border-edkut-border pb-1 font-heading text-sm font-bold text-edkut-blue">informações pessoais</h2>
                  <dl className="mt-2 overflow-hidden rounded-edkut border border-edkut-border" data-testid="info-table">
                    {infoRows.map((row, index) => (
                      <div key={row.label} className={`flex flex-col gap-0.5 px-3 py-1.5 text-sm sm:flex-row sm:gap-3 ${index % 2 === 0 ? "bg-white" : "bg-edkut-blueSoft"}`} data-row={row.label}>
                        <dt className="w-44 shrink-0 font-semibold text-edkut-muted">{row.label}</dt>
                        <dd className="min-w-0 flex-1 whitespace-pre-line break-words text-edkut-text">
                          {row.tags ? (
                            <span className="flex flex-wrap gap-1.5">
                              {row.tags.map((tag) => (
                                <Tag key={tag} label={tag} />
                              ))}
                            </span>
                          ) : (
                            row.value
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {isOwnProfile && (
                    <p className="mt-1.5 text-[11px] text-edkut-muted">
                      Campos vazios não aparecem. <Link href="/profile/edit" className="edkut-link font-semibold">Editar minhas informações</Link>
                    </p>
                  )}
                </div>

                <ProfileApprovedTestimonials
                  firstName={firstName}
                  testimonials={testimonialItems}
                  authors={testimonialAuthors}
                  isOwnProfile={isOwnProfile}
                  loadError={testimonialsData.error}
                  onSeeAll={() => setActiveTab("depoimentos")}
                />
              </div>
            )}

            {activeTab === "recados" && (
              <ProfileScrapsSection
                profileOwner={profileUser}
                currentUser={currentUser}
                initialScraps={scrapItems}
                authors={scrapAuthors}
                isOwnProfile={isOwnProfile}
                friendshipStatus={friendshipState.status}
                loadError={scrapsData.error}
                onScrapsChange={handleScrapsChange}
              />
            )}

            {activeTab === "fotos" && (
              <ProfilePhotosSection
                firstName={firstName}
                isOwnProfile={isOwnProfile}
                photos={photos}
                total={photosTotal}
                unavailable={classic.migrationMissing}
                onAdded={(p) => {
                  setPhotos((prev) => [p, ...prev]);
                  setPhotosTotal((n) => (n === null ? n : n + 1));
                }}
                onRemoved={(id) => {
                  setPhotos((prev) => prev.filter((p) => p.id !== id));
                  setPhotosTotal((n) => (n === null ? n : Math.max(0, n - 1)));
                }}
              />
            )}

            {activeTab === "videos" && (
              <ProfileVideosSection
                firstName={firstName}
                isOwnProfile={isOwnProfile}
                videos={videos}
                total={videosTotal}
                unavailable={classic.migrationMissing}
                onAdded={(v) => {
                  setVideos((prev) => [v, ...prev]);
                  setVideosTotal((n) => (n === null ? n : n + 1));
                }}
                onRemoved={(id) => {
                  setVideos((prev) => prev.filter((v) => v.id !== id));
                  setVideosTotal((n) => (n === null ? n : Math.max(0, n - 1)));
                }}
              />
            )}

            {activeTab === "depoimentos" && (
              <ProfileTestimonialsSection
                profileOwner={profileUser}
                currentUser={currentUser}
                initialTestimonials={testimonialItems}
                authors={testimonialAuthors}
                isOwnProfile={isOwnProfile}
                loadError={testimonialsData.error}
                onPendingChange={setPendingTestimonials}
                onItemsChange={handleTestimonialsChange}
              />
            )}
          </div>
        </div>
      </section>

      {/* Coluna direita — conexões sociais */}
      <aside className="flex flex-col gap-3 lg:order-3" aria-label="Amigos e comunidades">
        <div id="amigos-section">
          <FriendGrid
            friends={friends.slice(0, 9)}
            title={`amigos (${profileUser.friendIds.length})`}
            viewAllHref={friendsHref}
            columns={3}
            emptyMessage={isOwnProfile ? "Você ainda não tem amigos." : `${firstName} ainda não tem amigos.`}
            emptyAction={isOwnProfile ? { href: "/search", label: "buscar pessoas" } : undefined}
          />
        </div>

        <ProfileCommunitiesBox
          communities={classic.communities}
          total={classic.counts.communities}
          viewAllHref={communitiesHref}
          emptyMessage={isOwnProfile ? "Você ainda não participa de comunidades." : `${firstName} ainda não participa de comunidades.`}
          emptyAction={isOwnProfile ? { href: "/communities", label: "ver comunidades" } : undefined}
        />

        <div className="rounded-edkut border border-edkut-border bg-white p-3">
          <h3 className="mb-2 border-b border-edkut-border pb-1.5 font-heading text-sm font-bold text-edkut-blue">o que significam os indicadores</h3>
          <ul className="flex flex-col gap-2">
            {TECH_LEGEND.map((item) => (
              <li key={item.label} className="text-xs text-edkut-muted">
                <span className="font-heading font-bold" style={{ color: item.color }}>
                  {item.label}
                </span>{" "}
                — {item.description}
              </li>
            ))}
          </ul>
          <p className="mt-2 border-t border-edkut-border pt-2 text-[11px] text-edkut-muted">
            Até 3 símbolos, a partir da média simples (todos os amigos com o mesmo peso) das notas de 0 a 100 dadas pelos amigos. Passe o mouse para ver o percentual.
          </p>
        </div>
      </aside>
    </div>
  );
}
