"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Testimonial, User } from "@/types";
import { TestimonialCard } from "./TestimonialCard";
import { UserAvatar } from "./Avatar";
import { getUserById } from "@/mocks/users";
import { createTestimonial } from "@/services/testimonialService";

interface ProfileTestimonialsSectionProps {
  profileOwner: User;
  currentUser: User;
  initialTestimonials: Testimonial[];
  isOwnProfile: boolean;
  previewCount?: number;
}

export function ProfileTestimonialsSection({
  profileOwner,
  currentUser,
  initialTestimonials,
  isOwnProfile,
  previewCount = 3,
}: ProfileTestimonialsSectionProps) {
  const [testimonials, setTestimonials] = useState(initialTestimonials);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = message.trim();
    if (!text) return;
    setSubmitting(true);
    const newTestimonial = await createTestimonial({
      profileOwnerId: profileOwner.id,
      authorId: currentUser.id,
      message: text,
    });
    setTestimonials((prev) => [newTestimonial, ...prev]);
    setMessage("");
    setSubmitting(false);
  }

  return (
    <div className="edkut-card">
      <div className="edkut-card-title flex items-center justify-between">
        <span>depoimentos</span>
        {isOwnProfile && (
          <Link href="/testimonials" className="text-xs font-normal text-edkut-pink hover:underline">
            ver todos
          </Link>
        )}
      </div>

      <div className="px-3.5">
        {!isOwnProfile && (
          <form onSubmit={handleSubmit} className="flex gap-2 py-3">
            <UserAvatar user={currentUser} size="xs" />
            <div className="flex-1">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={`Escreva um depoimento sobre ${profileOwner.name.split(" ")[0]}...`}
                rows={2}
                className="edkut-input resize-none"
                disabled={submitting}
              />
              <div className="mt-1.5 flex justify-end">
                <button type="submit" className="edkut-btn-outline py-1 text-xs" disabled={submitting || !message.trim()}>
                  enviar depoimento
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="border-t border-edkut-border">
          {testimonials.length === 0 ? (
            <p className="py-3 text-sm text-edkut-muted">Nenhum depoimento por aqui ainda.</p>
          ) : (
            testimonials.slice(0, previewCount).map((testimonial) => (
              <TestimonialCard key={testimonial.id} testimonial={testimonial} author={getUserById(testimonial.authorId)} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
