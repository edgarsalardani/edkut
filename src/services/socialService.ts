// ---------------------------------------------------------------------------
// Amizades e avaliações — leituras no SERVIDOR (Server Components). Somente servidor
// (usa o cliente Supabase com cookies). As ações (enviar/aceitar/votar) ficam em lib/friendships.ts
// e lib/ratings.ts, no navegador, e são protegidas por RLS/RPCs.
// ---------------------------------------------------------------------------
import { createClient } from "@/lib/supabase/server";
import { getProfileUsersByIds } from "@/services/authService";
import { getFriendsOf as getMockFriendsOf } from "@/services/userService";
import { getPendingRequests as getMockPendingRequests, type PendingRequestWithUser } from "@/services/friendService";
import { isUuid } from "@/lib/uuid";
import type { MyRating } from "@/lib/ratings";
import type { User } from "@/types";

export type FriendshipStatus = "self" | "friends" | "request_sent" | "request_received" | "none";

export interface FriendshipState {
  status: FriendshipStatus;
  /** id da solicitação pendente (quando enviada ou recebida). */
  requestId?: string;
}

/** Relação entre o usuário logado e outro perfil REAL: amigos, solicitação pendente (enviada/recebida) ou nada. */
export async function getFriendshipState(currentUserId: string, otherId: string): Promise<FriendshipState> {
  if (currentUserId === otherId) return { status: "self" };
  if (!isUuid(otherId)) return { status: "none" };

  const supabase = createClient();
  const a = currentUserId < otherId ? currentUserId : otherId;
  const b = currentUserId < otherId ? otherId : currentUserId;

  const { data: friendship } = await supabase
    .from("friendships")
    .select("user_a")
    .eq("user_a", a)
    .eq("user_b", b)
    .maybeSingle();
  if (friendship) return { status: "friends" };

  // RLS: só enxergo solicitações em que sou remetente ou destinatário.
  const { data: pending } = await supabase
    .from("friend_requests")
    .select("id, sender_id")
    .eq("status", "pending")
    .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${currentUserId})`)
    .limit(1)
    .maybeSingle();
  const row = pending as { id: string; sender_id: string } | null;
  if (row) {
    return { status: row.sender_id === currentUserId ? "request_sent" : "request_received", requestId: row.id };
  }
  return { status: "none" };
}

/** Minha avaliação sobre alguém (só enxergo a PRÓPRIA, por RLS). null se nunca avaliei ou se o recurso não está instalado. */
export async function getMyRating(ratedId: string): Promise<MyRating | null> {
  if (!isUuid(ratedId)) return null;
  const supabase = createClient();
  const { data, error } = await supabase.rpc("my_friend_rating", { p_rated: ratedId });
  const row = ((data as unknown as { nerd: number; parceiro: number; tech: number; is_current: boolean }[] | null) ?? [])[0];
  if (error || !row) return null;
  return { nerd: row.nerd, parceiro: row.parceiro, tech: row.tech, isCurrent: row.is_current };
}

/**
 * Amigos de um usuário: REAIS (tabela friendships) para ids UUID; fictícios (mocks) para os demais.
 */
export async function getFriendsOf(userId: string): Promise<User[]> {
  if (!isUuid(userId)) return getMockFriendsOf(userId);
  const supabase = createClient();
  const { data } = await supabase.rpc("friend_ids_of", { p_user: userId });
  const ids = (Array.isArray(data) ? data : [])
    .map((item: unknown) => (typeof item === "string" ? item : item && typeof item === "object" ? String(Object.values(item)[0] ?? "") : ""))
    .filter((id: string) => isUuid(id));
  return getProfileUsersByIds(ids);
}

/** Solicitações de amizade RECEBIDAS e pendentes: reais (friend_requests) para UUID; fictícias para os demais. */
export async function getPendingRequests(userId: string): Promise<PendingRequestWithUser[]> {
  if (!isUuid(userId)) return getMockPendingRequests(userId);
  const supabase = createClient();
  const { data } = await supabase
    .from("friend_requests")
    .select("id, sender_id, receiver_id, created_at")
    .eq("receiver_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  const rows = (data as unknown as { id: string; sender_id: string; receiver_id: string; created_at: string }[] | null) ?? [];
  const senders = await getProfileUsersByIds(rows.map((r) => r.sender_id));
  const byId = new Map(senders.map((u) => [u.id, u]));
  const result: PendingRequestWithUser[] = [];
  for (const r of rows) {
    const fromUser = byId.get(r.sender_id);
    if (!fromUser) continue;
    result.push({ id: r.id, fromUserId: r.sender_id, toUserId: r.receiver_id, createdAt: r.created_at, status: "pending", fromUser });
  }
  return result;
}
