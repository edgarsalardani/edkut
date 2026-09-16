import { AppShell } from "@/components/AppShell";
import { ProfileTestimonialsSection } from "@/components/ProfileTestimonialsSection";
import { getCurrentUser } from "@/services/userService";
import { getTestimonials } from "@/services/testimonialService";

export default async function TestimonialsPage() {
  const currentUser = await getCurrentUser();
  const testimonials = await getTestimonials(currentUser.id);

  return (
    <AppShell>
      <div className="mb-4 edkut-card p-4">
        <h1 className="font-heading text-lg font-bold text-edkut-blue">depoimentos</h1>
        <p className="text-sm text-edkut-muted">O que amigos e colegas do edkut disseram sobre você.</p>
      </div>

      <ProfileTestimonialsSection
        profileOwner={currentUser}
        currentUser={currentUser}
        initialTestimonials={testimonials}
        isOwnProfile
        previewCount={testimonials.length}
      />
    </AppShell>
  );
}
