import { AppShell } from "@/components/AppShell";
import { ProfileTestimonialsSection } from "@/components/ProfileTestimonialsSection";
import { getCurrentUser } from "@/services/authService";
import { getTestimonialsWithAuthors } from "@/services/testimonialService";

export default async function TestimonialsPage() {
  const currentUser = await getCurrentUser();
  const { testimonials, authors, error } = await getTestimonialsWithAuthors(currentUser.id);

  return (
    <AppShell>
      <div className="mb-4 edkut-card p-4">
        <h1 className="font-heading text-lg font-bold text-edkut-blue">depoimentos</h1>
        <p className="text-sm text-edkut-muted">
          O que amigos e colegas escreveram sobre você. Só aparecem no seu perfil os que você aprovar.
        </p>
      </div>

      <ProfileTestimonialsSection
        profileOwner={currentUser}
        currentUser={currentUser}
        initialTestimonials={testimonials}
        authors={authors}
        isOwnProfile
        loadError={error}
      />
    </AppShell>
  );
}
