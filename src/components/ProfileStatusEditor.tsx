"use client";

import { FormEvent, useRef, useState } from "react";
import { saveStatus } from "@/lib/profileExtras";
import { STATUS_MAX, charLength } from "@/lib/profileClassic";

interface ProfileStatusEditorProps {
  userId: string;
  /** Frase atual (ausente = sem status). */
  value?: string;
  isOwnProfile: boolean;
  disabled?: boolean;
  onChange: (next: string | undefined) => void;
}

/** Frase de status logo abaixo do nome. Só o dono edita, ali mesmo (sem página separada); vazio remove o status. */
export function ProfileStatusEditor({ userId, value, isOwnProfile, disabled = false, onChange }: ProfileStatusEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  async function submit(e?: FormEvent, forced?: string) {
    e?.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    const result = await saveStatus(userId, forced ?? draft);
    busy.current = false;
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Não foi possível salvar o status.");
      return;
    }
    const next = result.data?.statusPhrase;
    onChange(next);
    setDraft(next ?? "");
    setEditing(false);
  }

  function cancel() {
    setDraft(value ?? "");
    setError(null);
    setEditing(false);
  }

  if (!isOwnProfile) {
    return value ? <p className="[overflow-wrap:anywhere] text-sm italic text-edkut-text" data-testid="status-phrase">&ldquo;{value}&rdquo;</p> : null;
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {value ? (
          <p className="[overflow-wrap:anywhere] text-sm italic text-edkut-text" data-testid="status-phrase">
            &ldquo;{value}&rdquo;
          </p>
        ) : (
          <p className="text-sm text-edkut-faint">escreva uma frase de status…</p>
        )}
        <button type="button" className="edkut-link text-xs font-bold" disabled={disabled} onClick={() => { setDraft(value ?? ""); setEditing(true); }}>
          {value ? "editar" : "adicionar"}
        </button>
        {disabled && <span className="text-[11px] text-edkut-muted">(precisa da migração 14)</span>}
      </div>
    );
  }

  const length = charLength(draft.trim());
  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5" aria-label="Editar frase de status">
      <div className="flex gap-1.5">
        <input
          autoFocus
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setError(null); }}
          onKeyDown={(e) => { if (e.key === "Escape") cancel(); }}
          className="edkut-input"
          placeholder="Sou feito de luz, cor e alegria!"
          aria-label="Frase de status"
          disabled={saving}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button type="submit" className="edkut-btn-pink px-3 py-0.5 text-xs" disabled={saving || length > STATUS_MAX}>
          {saving ? "salvando..." : "salvar"}
        </button>
        <button type="button" className="edkut-btn-outline px-3 py-0.5 text-xs" onClick={cancel} disabled={saving}>
          cancelar
        </button>
        {value && (
          <button type="button" className="edkut-link" onClick={() => void submit(undefined, "")} disabled={saving}>
            remover frase
          </button>
        )}
        <span className={length > STATUS_MAX ? "font-bold text-edkut-pinkDark" : "text-edkut-muted"}>{length}/{STATUS_MAX}</span>
      </div>
      {error && (
        <p role="alert" className="text-xs text-edkut-pinkDark">
          {error}
        </p>
      )}
    </form>
  );
}
