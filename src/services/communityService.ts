import { Community, CommunityCategory } from "@/types";
import { communities, getCommunityById as findById } from "@/mocks/communities";
import { simulateDelay } from "./simulateDelay";

export async function getAllCommunities(): Promise<Community[]> {
  return simulateDelay(communities);
}

export async function getCommunityById(id: string): Promise<Community | undefined> {
  return simulateDelay(findById(id));
}

export async function getMyCommunities(userId: string): Promise<Community[]> {
  return simulateDelay(communities.filter((c) => c.memberIds.includes(userId)));
}

export async function getPopularCommunities(limit = 6): Promise<Community[]> {
  const sorted = [...communities].sort((a, b) => b.memberCount - a.memberCount);
  return simulateDelay(sorted.slice(0, limit));
}

export async function getCommunitiesToDiscover(userId: string, limit = 6): Promise<Community[]> {
  const notJoined = communities.filter((c) => !c.memberIds.includes(userId));
  return simulateDelay(notJoined.slice(0, limit));
}

export async function getCommunitiesByCategory(category: CommunityCategory | "Todas"): Promise<Community[]> {
  if (category === "Todas") return simulateDelay(communities);
  return simulateDelay(communities.filter((c) => c.category === category));
}

export async function getCommunitiesByIds(ids: string[]): Promise<Community[]> {
  const list = ids
    .map((id) => findById(id))
    .filter((c): c is Community => Boolean(c));
  return simulateDelay(list);
}

export interface CreateCommunityInput {
  name: string;
  description: string;
  category: CommunityCategory;
  creatorId: string;
  emoji?: string;
}

/** Simula a criação de uma comunidade nova (não persiste entre recarregamentos). */
export async function createCommunity(input: CreateCommunityInput): Promise<Community> {
  const newCommunity: Community = {
    id: `c-local-${Date.now()}`,
    name: input.name,
    description: input.description,
    category: input.category,
    emoji: input.emoji ?? "💬",
    color: "#1D4E89",
    memberIds: [input.creatorId],
    memberCount: 1,
    creatorId: input.creatorId,
    moderatorIds: [input.creatorId],
    createdAt: new Date().toISOString(),
  };
  return simulateDelay(newCommunity, 200);
}
