"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Scrap, User } from "@/types";
import { ScrapCard } from "./ScrapCard";
import { UserAvatar } from "./Avatar";
import { getUserById } from "@/mocks/users";
import { createScrap } from "@/services/scrapService";

interface ProfileScrapsSectionProps {
  profileOwner: User;
  currentUser: User;
  initialScraps: Scrap[];
  isOwnProfile: boolean;
  previewCount?: number;
}

export function ProfileScrapsSection({
  profileOwner,
  currentUser,
  initialScraps,
  isOwnProfile,
  previewCount = 3,
}: ProfileScrapsSectionProps) {
  const [scraps, setScraps] = useState(initialScraps);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = message.trim();
    if (!text) return;
    setSubmitting(true);
    const newScrap = await createScrap({ profileOwnerId: profileOwner.id, authorId: currentUser.id, message: text });
    setScraps((prev) => [newScrap, ...prev]);
    setMessage("");
    setSubmitting(false);
  }

  return (
    <div className="edkut-card">
      <div className="edkut-card-title flex items-center justify-between">
        <span>scraps de {profileOwner.name.split(" ")[0]}</span>
        {isOwnProfile && (
          <Link href="/scraps" className="text-xs font-normal text-edkut-pink hover:underline">
            ver todos
          </Link>
        )}
      </div>

      <div className="px-3.5">
        <form onSubmit={handleSubmit} className="flex gap-2 py-3">
          <UserAvatar user={currentUser} size="xs" />
          <div className="flex-1">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`Deixe um recado para ${profileOwner.name.split(" ")[0]}...`}
              rows={2}
              className="edkut-input resize-none"
              disabled={submitting}
            />
            <div className="mt-1.5 flex justify-end">
              <button type="submit" className="edkut-btn-outline py-1 text-xs" disabled={submitting || !message.trim()}>
                enviar scrap
              </button>
            </div>
          </div>
        </form>

        <div className="border-t border-edkut-border">
          {scraps.length === 0 ? (
            <p className="py-3 text-sm text-edkut-muted">Nenhum scrap por aqui ainda.</p>
          ) : (
            scraps.slice(0, previewCount).map((scrap) => (
              <ScrapCard key={scrap.id} scrap={scrap} author={getUserById(scrap.authorId)} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
