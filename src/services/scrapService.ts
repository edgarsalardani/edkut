import { Scrap } from "@/types";
import { getScrapsByProfile } from "@/mocks/scraps";
import { simulateDelay } from "./simulateDelay";

export async function getScraps(profileOwnerId: string): Promise<Scrap[]> {
  return simulateDelay(getScrapsByProfile(profileOwnerId));
}

export interface CreateScrapInput {
  profileOwnerId: string;
  authorId: string;
  message: string;
}

export async function createScrap(input: CreateScrapInput): Promise<Scrap> {
  const newScrap: Scrap = {
    id: `s-local-${Date.now()}`,
    profileOwnerId: input.profileOwnerId,
    authorId: input.authorId,
    message: input.message,
    createdAt: new Date().toISOString(),
  };
  return simulateDelay(newScrap, 150);
}
