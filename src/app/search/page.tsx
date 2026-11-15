import { AppShell } from "@/components/AppShell";
import { SearchBar } from "@/components/Search";
import { PersonResultCard } from "@/components/PersonResultCard";
import { searchPeople } from "@/services/peopleSearchService";
import { MIN_QUERY_LENGTH, SEARCH_LIMIT } from "@/lib/peopleSearch";
import { getCurrentUser } from "@/services/authService";

interface SearchPageProps {
  searchParams: { q?: string };
}

/**
 * Busca de PESSOAS reais (public.profiles). Comunidades e publicações ainda não foram integradas:
 * não aparecem aqui (nada de resultados fictícios).
 */
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const currentUser = await getCurrentUser();
  const query = (searchParams.q ?? "").trim();
  const people = query ? await searchPeople(query, currentUser.id) : null;

  return (
    <AppShell>
      <div className="mb-4 edkut-card p-4">
        <h1 className="font-heading text-lg font-bold text-edkut-blue">busca</h1>
        <p className="mb-3 text-sm text-edkut-muted">Pesquise pessoas pelo nome ou @username.</p>
        <SearchBar initialQuery={query} size="large" placeholder="digite um nome ou @username..." />
      </div>

      {!query ? (
        <div className="edkut-card p-6 text-center text-sm text-edkut-muted">
          Digite o nome ou o @username de alguém para encontrar pessoas no edkut.
        </div>
      ) : (
        <div className="edkut-card">
          <div className="edkut-card-title">pessoas{people?.status === "ok" ? ` (${people.people.length})` : ""}</div>
          <div>
            {people?.status === "too_short" && (
              <p className="p-3.5 text-sm text-edkut-muted">
                Digite pelo menos {MIN_QUERY_LENGTH} caracteres do nome ou do username para buscar pessoas.
              </p>
            )}
            {people?.status === "error" && (
              <p role="alert" className="m-3.5 rounded-edkut border border-edkut-pink bg-edkut-pinkSoft px-3 py-2 text-sm text-edkut-pinkDark">
                Não foi possível buscar pessoas agora. Tente novamente em instantes.
              </p>
            )}
            {people?.status === "ok" && people.people.length === 0 && (
              <p className="p-3.5 text-sm text-edkut-muted">
                Nenhuma pessoa encontrada para &ldquo;{people.query}&rdquo;. Confira a grafia ou tente buscar pelo username.
              </p>
            )}
            {people?.status === "ok" && people.people.length > 0 && (
              <>
                <ul>
                  {people.people.map((result, index) => (
                    <PersonResultCard
                      key={result.user.id}
                      person={result.user}
                      friendship={result.friendship}
                      currentUserId={currentUser.id}
                      isLast={index === people.people.length - 1}
                    />
                  ))}
                </ul>
                {people.truncated && (
                  <p className="border-t border-edkut-border px-3.5 py-2 text-xs text-edkut-muted">
                    Mostrando as {SEARCH_LIMIT} primeiras pessoas. Refine a busca (nome completo ou username) para ver outras.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
