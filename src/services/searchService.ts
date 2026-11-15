import { SearchResults } from "@/types";
import { communities } from "@/mocks/communities";
import { posts } from "@/mocks/posts";
import { simulateDelay } from "./simulateDelay";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export async function search(query: string): Promise<SearchResults> {
  const q = normalize(query.trim());
  if (!q) {
    return simulateDelay({ people: [], communities: [], posts: [] });
  }

  // Pessoas NÃO vêm mais daqui: a busca de pessoas é real (services/peopleSearchService.ts, tabela profiles).
  // Mantido `people: []` só para não mudar o tipo SearchResults; usuários fictícios nunca entram nos resultados.
  const people: SearchResults["people"] = [];

  const matchedCommunities = communities.filter(
    (c) => normalize(c.name).includes(q) || normalize(c.description).includes(q) || normalize(c.category).includes(q)
  );

  const matchedPosts = posts.filter((p) => normalize(p.text).includes(q));

  return simulateDelay({ people, communities: matchedCommunities, posts: matchedPosts });
}
