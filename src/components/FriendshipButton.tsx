"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { acceptRequest, cancelRequest, declineRequest, removeFriendship, sendFriendRequest } from "@/lib/friendships";
import type { FriendshipState } from "@/services/socialService";

interface FriendshipButtonProps {
  currentUserId: string;
  profileId: string;
  initial: FriendshipState;
  /** Chamado quando o estado muda (o pai usa para mostrar/esconder o painel de avaliação). */
  onChange?: (state: FriendshipState) => void;
  /** Versão para listas (ex.: resultados da busca): alinhada à esquerda/direita e sem "desfazer amizade". */
  compact?: boolean;
}

/**
 * Botão de amizade REAL (perfis com id UUID): adicionar, cancelar solicitação, aceitar/recusar e desfazer.
 * Toda a segurança está nas policies/RPCs do Supabase; aqui só orquestramos a interface.
 */
export function FriendshipButton({ currentUserId, profileId, initial, onChange, compact = false }: FriendshipButtonProps) {
  const router = useRouter();
  const [state, setState] = useState<FriendshipState>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);

  function apply(next: FriendshipState) {
    setState(next);
    onChange?.(next);
    router.refresh(); // atualiza contagem de amigos, listas e notificações
  }

  async function run(action: () => Promise<{ ok: boolean; error?: string; requestId?: string }>, next: (r: { requestId?: string }) => FriendshipState) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    setConfirmingRemoval(false);
    if (!result.ok) {
      setError(result.error ?? "Não foi possível concluir a ação.");
      return;
    }
    apply(next(result));
  }

  return (
    <div className={`flex flex-col gap-1.5 ${compact ? "items-start sm:items-end" : "w-full items-center"}`}>
      {state.status === "none" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => sendFriendRequest(profileId), (r) => ({ status: "request_sent", requestId: r.requestId }))}
          className="edkut-btn-pink disabled:opacity-60"
        >
          {busy ? "enviando..." : "adicionar amigo"}
        </button>
      )}

      {state.status === "request_sent" && (
        <>
          <p className="text-xs font-semibold text-edkut-muted">solicitação enviada</p>
          <button
            type="button"
            disabled={busy || !state.requestId}
            onClick={() => run(() => cancelRequest(state.requestId as string), () => ({ status: "none" }))}
            className="edkut-btn-outline disabled:opacity-60"
          >
            {busy ? "cancelando..." : "cancelar solicitação"}
          </button>
        </>
      )}

      {state.status === "request_received" && (
        <>
          <p className="text-xs font-semibold text-edkut-pink">quer ser seu amigo</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={busy || !state.requestId}
              onClick={() => run(() => acceptRequest(state.requestId as string), () => ({ status: "friends" }))}
              className="edkut-btn-pink disabled:opacity-60"
            >
              aceitar
            </button>
            <button
              type="button"
              disabled={busy || !state.requestId}
              onClick={() => run(() => declineRequest(state.requestId as string), () => ({ status: "none" }))}
              className="edkut-btn-outline disabled:opacity-60"
            >
              recusar
            </button>
          </div>
        </>
      )}

      {state.status === "friends" && (
        <>
          <p className="text-xs font-semibold text-edkut-green">vocês já são amigos</p>
          {compact ? null : !confirmingRemoval ? (
            <button type="button" onClick={() => setConfirmingRemoval(true)} className="edkut-link text-[11px]">
              desfazer amizade
            </button>
          ) : (
            <div className="flex flex-col items-center gap-1 rounded-edkut border border-edkut-border bg-edkut-blueSoft p-2 text-center">
              <p className="text-[11px] text-edkut-text">
                Desfazer a amizade? As avaliações entre vocês deixam de contar nos indicadores.
              </p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => removeFriendship(currentUserId, profileId), () => ({ status: "none" }))}
                  className="edkut-btn-pink disabled:opacity-60"
                >
                  {busy ? "desfazendo..." : "desfazer"}
                </button>
                <button type="button" onClick={() => setConfirmingRemoval(false)} className="edkut-btn-outline">
                  manter
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="text-center text-[11px] font-semibold text-edkut-pinkDark">
          {error}
        </p>
      )}
    </div>
  );
}
