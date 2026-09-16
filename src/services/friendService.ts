import { FriendRequest, User } from "@/types";
import { getUserById as findUserById } from "@/mocks/users";
import { getPendingRequestsForUser } from "@/mocks/friendRequests";
import { getFriendsOf, getFriendSuggestions } from "./userService";
import { simulateDelay } from "./simulateDelay";

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
export async function acceptFriendRequest(requestId: string): Promise<{ requestId: string; status: "accepted" }> {
  return simulateDelay({ requestId, status: "accepted" }, 150);
}

export async function declineFriendRequest(requestId: string): Promise<{ requestId: string; status: "declined" }> {
  return simulateDelay({ requestId, status: "declined" }, 150);
}
