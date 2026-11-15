import { Testimonial, User } from "@/types";
import { TestimonialCard } from "./TestimonialCard";

interface ProfileApprovedTestimonialsProps {
  firstName: string;
  testimonials: Testimonial[];
  authors: User[];
  /** Quantos depoimentos aparecem no perfil antes do link "ver todos". */
  limit?: number;
  onSeeAll: () => void;
  isOwnProfile: boolean;
  /** A leitura no servidor falhou: mostra aviso em vez de "nenhum depoimento". */
  loadError?: boolean;
}

/**
 * Depoimentos APROVADOS, somente leitura, logo abaixo das informações do perfil. Nunca mostra pendentes
 * nem recusados (nem os do próprio visitante): esses ficam só na aba "depoimentos", com o status.
 * A aba continua sendo o lugar de escrever, aprovar, recusar e apagar.
 */
export function ProfileApprovedTestimonials({
  firstName,
  testimonials,
  authors,
  limit = 3,
  onSeeAll,
  isOwnProfile,
  loadError = false,
}: ProfileApprovedTestimonialsProps) {
  const approved = testimonials
    .filter((t) => t.status === "approved")
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const authorsById = new Map(authors.map((a) => [a.id, a]));
  const shown = approved.slice(0, limit);

  return (
    <div>
      <div className="flex items-baseline justify-between border-b border-edkut-border pb-1">
        <h2 className="font-heading text-sm font-bold text-edkut-blue">depoimentos</h2>
        <button type="button" onClick={onSeeAll} className="text-xs text-edkut-pink hover:underline">
          {approved.length > limit ? `ver todos (${approved.length})` : isOwnProfile ? "gerenciar" : "escrever um depoimento"}
        </button>
      </div>
      {loadError ? (
        <p role="alert" className="mt-2 text-sm text-edkut-pinkDark">
          Não foi possível carregar os depoimentos agora. Atualize a página para tentar de novo.
        </p>
      ) : shown.length === 0 ? (
        <p className="mt-2 text-sm text-edkut-muted">
          {isOwnProfile ? "Você ainda não tem depoimentos publicados." : `${firstName} ainda não tem depoimentos publicados.`}
        </p>
      ) : (
        <div className="mt-1">
          {shown.map((t) => (
            <div key={t.id} className="border-b border-edkut-border last:border-b-0">
              <TestimonialCard testimonial={t} author={authorsById.get(t.authorId)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
