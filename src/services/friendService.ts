// ---------------------------------------------------------------------------
// Ações de solicitações de amizade usadas pela tela /friends (navegador). Tudo REAL: chama as RPCs
// accept_friend_request / decline_friend_request (lib/friendships.ts). Não há mais solicitações simuladas.
// A listagem de solicitações recebidas está em services/socialService.ts (servidor).
// ---------------------------------------------------------------------------
import { FriendRequest, User } from "@/types";
import { acceptRequest, declineRequest } from "@/lib/friendships";

export interface PendingRequestWithUser extends FriendRequest {
  fromUser: User;
}

export async function acceptFriendRequest(requestId: string): Promise<{ requestId: string; status: "accepted"; ok: boolean; error?: string }> {
  const result = await acceptRequest(requestId);
  return { requestId, status: "accepted", ok: result.ok, error: result.error };
}

export async function declineFriendRequest(requestId: string): Promise<{ requestId: string; status: "declined"; ok: boolean; error?: string }> {
  const result = await declineRequest(requestId);
  return { requestId, status: "declined", ok: result.ok, error: result.error };
}
