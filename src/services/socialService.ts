// ---------------------------------------------------------------------------
// Amizades e avaliações — leituras no SERVIDOR (Server Components). Somente servidor
// (usa o cliente Supabase com cookies). As ações (enviar/aceitar/votar) ficam em lib/friendships.ts
// e lib/ratings.ts, no navegador, e são protegidas por RLS/RPCs.
// ---------------------------------------------------------------------------
import { createClient } from "@/lib/supabase/server";
import { getProfileUsersByIds } from "@/services/authService";
import type { PendingRequestWithUser } from "@/services/friendService";
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

/** `friend_ids_of` devolve `setof uuid`: aceita tanto ["id", ...] quanto [{ friend_ids_of: "id" }, ...]. */
function idsFromRpc(data: unknown): string[] {
  return (Array.isArray(data) ? data : [])
    .map((item: unknown) => (typeof item === "string" ? item : item && typeof item === "object" ? String(Object.values(item)[0] ?? "") : ""))
    .filter((id: string) => isUuid(id));
}

/**
 * Relação do usuário logado com VÁRIAS pessoas de uma vez (lista de resultados da busca), com 2 consultas fixas
 * (independente do número de resultados): amigos (friend_ids_of) e solicitações pendentes (RLS: só as minhas).
 * Quem não aparece em nenhuma das duas fica "none". Qualquer falha lança erro: melhor avisar do que mostrar
 * "adicionar amigo" para quem já é amigo.
 */
export async function getFriendshipStates(currentUserId: string, otherIds: string[]): Promise<Map<string, FriendshipState>> {
  const states = new Map<string, FriendshipState>();
  const wanted = otherIds.filter((id) => isUuid(id) && id !== currentUserId);
  for (const id of wanted) states.set(id, { status: "none" });
  if (wanted.length === 0 || !isUuid(currentUserId)) return states;

  const supabase = createClient();
  const [friendsRes, pendingRes] = await Promise.all([
    supabase.rpc("friend_ids_of", { p_user: currentUserId }),
    supabase
      .from("friend_requests")
      .select("id, sender_id, receiver_id")
      .eq("status", "pending")
      .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`),
  ]);
  if (friendsRes.error) throw new Error(`Não foi possível carregar suas amizades (${friendsRes.error.message}).`);
  if (pendingRes.error) throw new Error(`Não foi possível carregar suas solicitações (${pendingRes.error.message}).`);

  for (const row of (pendingRes.data as unknown as { id: string; sender_id: string; receiver_id: string }[] | null) ?? []) {
    const otherId = row.sender_id === currentUserId ? row.receiver_id : row.sender_id;
    if (states.has(otherId)) {
      states.set(otherId, { status: row.sender_id === currentUserId ? "request_sent" : "request_received", requestId: row.id });
    }
  }
  // Amizade vence qualquer solicitação antiga/residual.
  for (const id of idsFromRpc(friendsRes.data)) {
    if (states.has(id)) states.set(id, { status: "friends" });
  }
  return states;
}

/**
 * Amigos de um usuário: REAIS (tabela friendships); ids que não são UUID => lista vazia (não há mais usuários fictícios).
 */
export async function getFriendsOf(userId: string): Promise<User[]> {
  if (!isUuid(userId)) return [];
  const supabase = createClient();
  const { data } = await supabase.rpc("friend_ids_of", { p_user: userId });
  return getProfileUsersByIds(idsFromRpc(data));
}

/** Solicitações de amizade RECEBIDAS e pendentes (friend_requests). */
export async function getPendingRequests(userId: string): Promise<PendingRequestWithUser[]> {
  if (!isUuid(userId)) return [];
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
