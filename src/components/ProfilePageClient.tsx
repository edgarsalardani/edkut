"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Scrap, Testimonial, User } from "@/types";
import { UserAvatar } from "./Avatar";
import { ProfileAvatarEditor } from "./ProfileAvatarEditor";
import { Tag } from "./Tag";
import { TechProfileIndicators } from "./TechProfileIndicators";
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

// A aba "publicações" volta quando as publicações forem integradas ao Supabase.
type Tab = "perfil" | "recados" | "depoimentos";

const TABS: { id: Tab; label: string }[] = [
  { id: "perfil", label: "perfil" },
  { id: "recados", label: "recados" },
  { id: "depoimentos", label: "depoimentos" },
];

const TECH_LEGEND: { label: string; color: string; description: string }[] = [
  { label: "NERD", color: "#D81B85", description: "a identificação da pessoa com a cultura de Computação e Tecnologia" },
  { label: "PARCEIRO", color: "#3FA66B", description: "o quanto a pessoa é vista como colaborativa e disposta a ajudar" },
  { label: "TECH", color: "#1D4E89", description: "o quanto a pessoa é vista como ligada ao universo da tecnologia" },
];

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
}: ProfilePageClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>("perfil");
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

  // Depoimentos aguardando aprovação (só o dono do perfil enxerga): destaca a aba para ele não perder nenhum.
  const [pendingTestimonials, setPendingTestimonials] = useState(
    isOwnProfile ? testimonialsData.testimonials.filter((t) => t.status === "pending").length : 0
  );
  const tabLabel = (t: { id: Tab; label: string }) =>
    t.id === "depoimentos" && isOwnProfile && pendingTestimonials > 0 ? `${t.label} (${pendingTestimonials})` : t.label;

  function handleFriendshipChange(next: FriendshipState) {
    setFriendshipState(next);
    // Amizade desfeita/criada muda quais votos valem: atualiza as barras.
    void refreshScores();
  }

  const infoRows: { label: string; value: string }[] = [
    { label: "tipo", value: USER_TYPE_LABEL[profileUser.userType] },
    ...(profileUser.institution ? [{ label: "instituição", value: profileUser.institution }] : []),
    ...(profileUser.courseOrArea ? [{ label: "curso/área", value: profileUser.courseOrArea }] : []),
    ...(profileUser.location ? [{ label: "localização", value: profileUser.location }] : []),
    {
      label: "membro desde",
      value: new Date(profileUser.joinedAt).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[200px_1fr_260px]">
      {/* Coluna esquerda — identidade e menu pessoal */}
      <aside className="flex flex-col gap-3 lg:order-1">
        <div className="rounded-edkut border border-edkut-border bg-white">
          <div className="flex flex-col items-center gap-1.5 p-3.5 text-center">
            {isOwnProfile ? (
              <ProfileAvatarEditor user={profileUser} />
            ) : (
              <UserAvatar user={profileUser} size="lg" />
            )}
            <p className="font-heading text-sm font-bold text-edkut-blue">{profileUser.name}</p>
            <p className="text-xs font-semibold text-edkut-pink">{USER_TYPE_LABEL[profileUser.userType]}</p>

            <div className="mt-1 flex w-full divide-x divide-edkut-border rounded-edkut border border-edkut-border text-center text-[11px] text-edkut-muted">
              <div className="flex-1 py-1">
                <p className="font-heading text-sm font-bold text-edkut-blue">{profileUser.friendIds.length}</p>
                amigos
              </div>
            </div>

            {isOwnProfile && (
              <Link href="/profile/edit" className="edkut-btn-outline w-full text-center">
                editar perfil
              </Link>
            )}
            {!isOwnProfile && (
              <FriendshipButton
                currentUserId={currentUser.id}
                profileId={profileUser.id}
                initial={friendship}
                onChange={handleFriendshipChange}
              />
            )}
          </div>

          <nav className="flex flex-col divide-y divide-edkut-border border-t border-edkut-border text-sm font-heading font-bold">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-3.5 py-2 text-left ${
                  activeTab === t.id ? "bg-edkut-blueSoft text-edkut-pink" : "edkut-link"
                }`}
              >
                {tabLabel(t)}
              </button>
            ))}
            <a href="#amigos-section" className="edkut-link px-3.5 py-2 text-left">
              amigos
            </a>
          </nav>
        </div>
      </aside>

      {/* Coluna central — página pessoal */}
      <section className="flex flex-col gap-3 lg:order-2">
        <div className="rounded-edkut border border-edkut-border bg-white p-3.5">
          <h1 className="font-heading text-lg font-bold text-edkut-blue">{profileUser.name}</h1>
          <p className="mb-2 text-xs text-edkut-muted">{profileUser.headline}</p>
          <TechProfileIndicators scores={scores} ratingsCount={ratingsCount} />
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
          <div className="flex border-b border-edkut-border text-sm font-heading font-bold">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex-1 px-2 py-2 text-center sm:flex-none sm:px-4 ${
                  activeTab === t.id
                    ? "border-b-2 border-edkut-pink text-edkut-pink"
                    : "text-edkut-muted hover:text-edkut-blue"
                }`}
              >
                {tabLabel(t)}
              </button>
            ))}
          </div>

          <div className="p-3.5">
            {activeTab === "perfil" && (
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="border-b border-edkut-border pb-1 font-heading text-sm font-bold text-edkut-blue">
                    sobre {firstName}
                  </h2>
                  {profileUser.bio ? (
                    <p className="mt-2 text-sm italic text-edkut-text">&ldquo;{profileUser.bio}&rdquo;</p>
                  ) : (
                    <p className="mt-2 text-sm text-edkut-muted">{firstName} ainda não escreveu nada sobre si.</p>
                  )}
                </div>

                <div>
                  <h2 className="border-b border-edkut-border pb-1 font-heading text-sm font-bold text-edkut-blue">
                    informações
                  </h2>
                  <div className="mt-2 overflow-hidden rounded-edkut border border-edkut-border">
                    {infoRows.map((row, index) => (
                      <div
                        key={row.label}
                        className={`flex gap-3 px-3 py-1.5 text-sm ${
                          index % 2 === 0 ? "bg-white" : "bg-edkut-blueSoft"
                        }`}
                      >
                        <span className="w-28 shrink-0 font-semibold text-edkut-muted">{row.label}</span>
                        <span className="text-edkut-text">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {profileUser.interests.length > 0 && (
                  <div>
                    <h2 className="border-b border-edkut-border pb-1 font-heading text-sm font-bold text-edkut-blue">
                      interesses
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {profileUser.interests.map((interest) => (
                        <Tag key={interest} label={interest} />
                      ))}
                    </div>
                  </div>
                )}

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

      {/* Coluna direita — relações sociais */}
      <aside className="flex flex-col gap-3 lg:order-3">
        <div id="amigos-section">
          <FriendGrid
            friends={friends.slice(0, 9)}
            title="amigos"
            viewAllHref={isOwnProfile ? "/friends" : undefined}
            columns={3}
            emptyMessage={isOwnProfile ? "Você ainda não tem amigos." : `${firstName} ainda não tem amigos.`}
            emptyAction={isOwnProfile ? { href: "/search", label: "buscar pessoas" } : undefined}
          />
        </div>

        <div className="rounded-edkut border border-edkut-border bg-white p-3">
          <h3 className="mb-2 border-b border-edkut-border pb-1.5 font-heading text-sm font-bold text-edkut-blue">
            o que significam os indicadores
          </h3>
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
            Cada percentual é a média simples (todos os amigos com o mesmo peso) das notas de 0 a 100 dadas pelos amigos.
          </p>
        </div>
      </aside>
    </div>
  );
}
