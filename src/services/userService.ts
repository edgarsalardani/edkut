import { User } from "@/types";
import { users, getUserById as findUserById } from "@/mocks/users";
import { simulateDelay } from "./simulateDelay";

/**
 * Camada de "service" para usuários FICTÍCIOS (mocks). O usuário autenticado e os perfis
 * reais (UUID) vêm de services/authService.ts (Supabase). Hoje esta camada lê de mocks em memória; no futuro,
 * cada função aqui deve virar uma chamada HTTP (ex: fetch('/api/users/:id'))
 * mantendo a mesma assinatura, para que os componentes não precisem mudar.
 */

export async function getUserById(id: string): Promise<User | undefined> {
  return simulateDelay(findUserById(id));
}

export async function getAllUsers(): Promise<User[]> {
  return simulateDelay(users);
}

export async function getUsersByIds(ids: string[]): Promise<User[]> {
  const list = ids
    .map((id) => findUserById(id))
    .filter((u): u is User => Boolean(u));
  return simulateDelay(list);
}

export async function getFriendsOf(userId: string): Promise<User[]> {
  const user = findUserById(userId);
  if (!user) return simulateDelay([]);
  return getUsersByIds(user.friendIds);
}

export async function getFriendSuggestions(userId: string, limit = 5): Promise<User[]> {
  const user = findUserById(userId);
  if (!user) return simulateDelay([]);
  const suggestions = users.filter(
    (u) => u.id !== userId && !user.friendIds.includes(u.id)
  );
  return simulateDelay(suggestions.slice(0, limit));
}
