// ---------------------------------------------------------------------------
// Amizades REAIS no navegador (Supabase). Usa só o que já existe no banco (migração 3):
//   - enviar:   INSERT em friend_requests (receiver_id) — sender_id vem de auth.uid();
//   - aceitar / recusar / cancelar: RPCs accept_/decline_/cancel_friend_request;
//   - desfazer: DELETE em friendships (policy: qualquer uma das partes).
// A segurança está nas policies/RPCs; aqui só traduzimos erros para mensagens claras.
// ---------------------------------------------------------------------------
import { createClient } from "@/lib/supabase/client";

export interface FriendshipResult {
  ok: boolean;
  error?: string;
  /** id da solicitação criada (ao enviar). */
  requestId?: string;
}

function friendlyFriendshipError(error: { message?: string; code?: string }): string {
  const message = (error.message ?? "").toLowerCase();
  if (error.code === "23505" || message.includes("friend_requests_one_pending_per_pair")) {
    return "Já existe uma solicitação pendente entre vocês. Atualize a página.";
  }
  if (error.code === "42501" || message.includes("row-level security")) {
    return "Não foi possível enviar: vocês já podem ser amigos. Atualize a página.";
  }
  if (error.code === "P0002" || message.includes("not found or not pending")) {
    return "Esta solicitação não está mais pendente. Atualize a página.";
  }
  if (message.includes("failed to fetch") || message.includes("network")) {
    return "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.";
  }
  return "Não foi possível concluir a ação. Tente novamente.";
}

async function run<T>(fn: () => Promise<T>): Promise<T | FriendshipResult> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Variáveis do Supabase ausentes")) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: friendlyFriendshipError(e as { message?: string }) };
  }
}

export async function sendFriendRequest(receiverId: string): Promise<FriendshipResult> {
  return (await run<FriendshipResult>(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.from("friend_requests").insert({ receiver_id: receiverId }).select("id").single();
    if (error) return { ok: false, error: friendlyFriendshipError(error) };
    return { ok: true, requestId: (data as { id: string }).id };
  })) as FriendshipResult;
}

async function callRpc(name: "accept_friend_request" | "decline_friend_request" | "cancel_friend_request", requestId: string) {
  return (await run<FriendshipResult>(async () => {
    const supabase = createClient();
    const { error } = await supabase.rpc(name, { p_request_id: requestId });
    if (error) return { ok: false, error: friendlyFriendshipError(error) };
    return { ok: true };
  })) as FriendshipResult;
}

export const acceptRequest = (requestId: string) => callRpc("accept_friend_request", requestId);
export const declineRequest = (requestId: string) => callRpc("decline_friend_request", requestId);
export const cancelRequest = (requestId: string) => callRpc("cancel_friend_request", requestId);

/** Desfaz a amizade (a tabela guarda UMA linha por par, com user_a < user_b). */
export async function removeFriendship(userId: string, otherId: string): Promise<FriendshipResult> {
  return (await run<FriendshipResult>(async () => {
    const supabase = createClient();
    const a = userId < otherId ? userId : otherId;
    const b = userId < otherId ? otherId : userId;
    const { error, count } = await supabase
      .from("friendships")
      .delete({ count: "exact" })
      .eq("user_a", a)
      .eq("user_b", b);
    if (error) return { ok: false, error: friendlyFriendshipError(error) };
    if (!count) return { ok: false, error: "A amizade já havia sido desfeita. Atualize a página." };
    return { ok: true };
  })) as FriendshipResult;
}
