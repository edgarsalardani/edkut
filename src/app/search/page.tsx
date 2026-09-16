import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { SearchBar } from "@/components/Search";
import { UserAvatar } from "@/components/Avatar";
import { CommunityGrid } from "@/components/CommunityGrid";
import { PostCard } from "@/components/PostCard";
import { search } from "@/services/searchService";
import { getCurrentUser } from "@/services/userService";

interface SearchPageProps {
  searchParams: { q?: string };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const currentUser = await getCurrentUser();
  const query = (searchParams.q ?? "").trim();
  const results = query ? await search(query) : { people: [], communities: [], posts: [] };

  return (
    <AppShell>
      <div className="mb-4 edkut-card p-4">
        <h1 className="font-heading text-lg font-bold text-edkut-blue">busca</h1>
        <p className="mb-3 text-sm text-edkut-muted">Pesquise pessoas, comunidades e publicações no edkut.</p>
        <SearchBar initialQuery={query} size="large" placeholder="digite um nome, tema ou palavra-chave..." />
      </div>

      {!query ? (
        <div className="edkut-card p-6 text-center text-sm text-edkut-muted">
          Digite algo acima para buscar em todo o edkut.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="edkut-card">
            <div className="edkut-card-title">pessoas ({results.people.length})</div>
            <div className="p-3.5">
              {results.people.length === 0 ? (
                <p className="text-sm text-edkut-muted">Nenhuma pessoa encontrada para &ldquo;{query}&rdquo;.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {results.people.map((person) => (
                    <Link
                      key={person.id}
                      href={`/profile/${person.id}`}
                      className="flex flex-col items-center gap-1.5 rounded-edkut border border-edkut-border p-3 text-center hover:border-edkut-pink hover:bg-edkut-blueSoft"
                    >
                      <UserAvatar user={person} size="md" />
                      <span className="line-clamp-1 text-sm font-bold text-edkut-blue">{person.name}</span>
                      <span className="line-clamp-1 text-xs text-edkut-muted">{person.headline}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="edkut-card">
            <div className="edkut-card-title">comunidades ({results.communities.length})</div>
            <div className="p-3.5">
              <CommunityGrid
                communities={results.communities}
                emptyMessage={`Nenhuma comunidade encontrada para "${query}".`}
              />
            </div>
          </div>

          <div className="edkut-card">
            <div className="edkut-card-title">publicações ({results.posts.length})</div>
            <div className="flex flex-col gap-3 p-3.5">
              {results.posts.length === 0 ? (
                <p className="text-sm text-edkut-muted">Nenhuma publicação encontrada para &ldquo;{query}&rdquo;.</p>
              ) : (
                results.posts.map((post) => <PostCard key={post.id} post={post} currentUser={currentUser} />)
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
