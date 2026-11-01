"use client";

import { useState } from "react";
import { Community, Post, Scrap, Testimonial, User } from "@/types";
import { UserAvatar } from "./Avatar";
import { Tag } from "./Tag";
import { TechProfileIndicators } from "./TechProfileIndicators";
import { FriendGrid } from "./FriendGrid";
import { CommunityGrid } from "./CommunityGrid";
import { PostCard } from "./PostCard";
import { ProfileScrapsSection } from "./ProfileScrapsSection";
import { ProfileTestimonialsSection } from "./ProfileTestimonialsSection";
import { AddFriendButton } from "./AddFriendButton";
import { USER_TYPE_LABEL } from "@/lib/userType";

type Tab = "perfil" | "recados" | "depoimentos" | "publicacoes";

const TABS: { id: Tab; label: string }[] = [
  { id: "perfil", label: "perfil" },
  { id: "recados", label: "recados" },
  { id: "depoimentos", label: "depoimentos" },
  { id: "publicacoes", label: "publicações" },
];

const TECH_LEGEND: { label: string; color: string; description: string }[] = [
  { label: "TECH", color: "#1D4E89", description: "o quanto a pessoa é vista como ligada ao universo da tecnologia" },
  { label: "PARCEIRO", color: "#3FA66B", description: "o quanto a pessoa é vista como colaborativa e disposta a ajudar" },
  { label: "GEEK", color: "#D81B85", description: "a identificação da pessoa com a cultura de Computação e Tecnologia" },
];

interface ProfilePageClientProps {
  profileUser: User;
  currentUser: User;
  isOwnProfile: boolean;
  isAlreadyFriend: boolean;
  friends: User[];
  communities: Community[];
  posts: Post[];
  scraps: Scrap[];
  testimonials: Testimonial[];
}

export function ProfilePageClient({
  profileUser,
  currentUser,
  isOwnProfile,
  isAlreadyFriend,
  friends,
  communities,
  posts,
  scraps,
  testimonials,
}: ProfilePageClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>("perfil");
  const firstName = profileUser.name.split(" ")[0];

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
            <UserAvatar user={profileUser} size="lg" showOnline />
            <p className="font-heading text-sm font-bold text-edkut-blue">{profileUser.name}</p>
            <p className="text-xs font-semibold text-edkut-pink">{USER_TYPE_LABEL[profileUser.userType]}</p>

            <div className="mt-1 flex w-full divide-x divide-edkut-border rounded-edkut border border-edkut-border text-center text-[11px] text-edkut-muted">
              <div className="flex-1 py-1">
                <p className="font-heading text-sm font-bold text-edkut-blue">{profileUser.friendIds.length}</p>
                amigos
              </div>
              <div className="flex-1 py-1">
                <p className="font-heading text-sm font-bold text-edkut-blue">{profileUser.communityIds.length}</p>
                comunidades
              </div>
            </div>

            {!isOwnProfile && !isAlreadyFriend && <AddFriendButton />}
            {!isOwnProfile && isAlreadyFriend && (
              <p className="text-xs font-semibold text-edkut-green">vocês já são amigos</p>
            )}
          </div>

          <nav className="flex flex-col divide-y divide-edkut-border border-t border-edkut-border text-sm font-heading font-bold">
            {TABS.filter((t) => t.id !== "publicacoes").map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-3.5 py-2 text-left ${
                  activeTab === t.id ? "bg-edkut-blueSoft text-edkut-pink" : "edkut-link"
                }`}
              >
                {t.label}
              </button>
            ))}
            <a href="#amigos-section" className="edkut-link px-3.5 py-2 text-left">
              amigos
            </a>
            <a href="#comunidades-section" className="edkut-link px-3.5 py-2 text-left">
              comunidades
            </a>
          </nav>
        </div>
      </aside>

      {/* Coluna central — página pessoal */}
      <section className="flex flex-col gap-3 lg:order-2">
        <div className="rounded-edkut border border-edkut-border bg-white p-3.5">
          <h1 className="font-heading text-lg font-bold text-edkut-blue">{profileUser.name}</h1>
          <p className="mb-2 text-xs text-edkut-muted">{profileUser.headline}</p>
          <TechProfileIndicators scores={profileUser.techProfile} />
        </div>

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
                {t.label}
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
              </div>
            )}

            {activeTab === "recados" && (
              <ProfileScrapsSection
                profileOwner={profileUser}
                currentUser={currentUser}
                initialScraps={scraps}
                isOwnProfile={isOwnProfile}
                previewCount={scraps.length}
              />
            )}

            {activeTab === "depoimentos" && (
              <ProfileTestimonialsSection
                profileOwner={profileUser}
                currentUser={currentUser}
                initialTestimonials={testimonials}
                isOwnProfile={isOwnProfile}
                previewCount={testimonials.length}
              />
            )}

            {activeTab === "publicacoes" &&
              (posts.length === 0 ? (
                <p className="py-4 text-center text-sm text-edkut-muted">
                  {firstName} ainda não publicou nada por aqui.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {posts.map((post) => (
                    <PostCard key={post.id} post={post} currentUser={currentUser} />
                  ))}
                </div>
              ))}
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
          />
        </div>

        <div id="comunidades-section">
          <CommunityGrid
            communities={communities}
            title="comunidades"
            viewAllHref="/communities"
            variant="list"
            emptyMessage="Ainda não entrou em nenhuma comunidade."
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
        </div>
      </aside>
    </div>
  );
}
