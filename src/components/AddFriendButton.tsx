"use client";

import { useState } from "react";

/**
 * Ação visual de adicionar amigo. Sem backend, o clique só simula o envio
 * (estado local); numa integração futura chamaria um friendService.sendRequest.
 */
export function AddFriendButton() {
  const [sent, setSent] = useState(false);

  return (
    <button
      onClick={() => setSent(true)}
      disabled={sent}
      className={sent ? "edkut-btn-outline" : "edkut-btn-pink"}
    >
      {sent ? "solicitação enviada" : "adicionar amigo"}
    </button>
  );
}
