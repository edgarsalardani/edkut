import { FriendRequest, User } from "@/types";
import { getUserById as findUserById } from "@/mocks/users";
import { getPendingRequestsForUser } from "@/mocks/friendRequests";
import { getFriendsOf, getFriendSuggestions } from "./userService";
import { simulateDelay } from "./simulateDelay";
import { isUuid } from "@/lib/uuid";
import { acceptRequest, declineRequest } from "@/lib/friendships";

export { getFriendsOf, getFriendSuggestions };

export interface PendingRequestWithUser extends FriendRequest {
  fromUser: User;
}

export async function getPendingRequests(userId: string): Promise<PendingRequestWithUser[]> {
  const requests = getPendingRequestsForUser(userId);
  const withUser = requests
    .map((r) => {
      const fromUser = findUserById(r.fromUserId);
      return fromUser ? { ...r, fromUser } : null;
    })
    .filter((r): r is PendingRequestWithUser => Boolean(r));
  return simulateDelay(withUser);
}

/**
 * Simula aceitar uma solicitação. Como não há backend, o componente que
 * chama esta função é responsável por atualizar seu próprio estado local
 * (remover a solicitação da lista, adicionar o usuário aos amigos).
 */
export async function acceptFriendRequest(requestId: string): Promise<{ requestId: string; status: "accepted"; ok: boolean; error?: string }> {
  // Solicitação REAL (UUID): RPC accept_friend_request no Supabase. As fictícias seguem simuladas.
  if (isUuid(requestId)) {
    const result = await acceptRequest(requestId);
    return { requestId, status: "accepted", ok: result.ok, error: result.error };
  }
  return simulateDelay({ requestId, status: "accepted" as const, ok: true }, 150);
}

export async function declineFriendRequest(requestId: string): Promise<{ requestId: string; status: "declined"; ok: boolean; error?: string }> {
  if (isUuid(requestId)) {
    const result = await declineRequest(requestId);
    return { requestId, status: "declined", ok: result.ok, error: result.error };
  }
  return simulateDelay({ requestId, status: "declined" as const, ok: true }, 150);
}
