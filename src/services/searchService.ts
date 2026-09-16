import { SearchResults } from "@/types";
import { users } from "@/mocks/users";
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

  const people = users.filter(
    (u) =>
      normalize(u.name).includes(q) ||
      normalize(u.username).includes(q) ||
      normalize(u.bio).includes(q) ||
      u.interests.some((i) => normalize(i).includes(q))
  );

  const matchedCommunities = communities.filter(
    (c) => normalize(c.name).includes(q) || normalize(c.description).includes(q) || normalize(c.category).includes(q)
  );

  const matchedPosts = posts.filter((p) => normalize(p.text).includes(q));

  return simulateDelay({ people, communities: matchedCommunities, posts: matchedPosts });
}
