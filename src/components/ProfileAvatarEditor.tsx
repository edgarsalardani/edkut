"use client";

import { ChangeEvent, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "@/types";
import { Avatar, UserAvatar } from "./Avatar";
import { AVATAR_ACCEPT, saveAvatar, validateAvatarFile } from "@/lib/avatarUpload";

/**
 * Avatar grande do PRÓPRIO perfil com o fluxo: escolher imagem -> pré-visualizar -> salvar.
 * Só deve ser renderizado quando o perfil aberto é o do usuário autenticado.
 */
export function ProfileAvatarEditor({ user }: { user: User }) {
  const router = useRouter();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Libera a URL temporária da pré-visualização.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function handleChoose(e: ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (!chosen) return;
    setSaved(false);

    const check = await validateAvatarFile(chosen);
    if (!check.ok) {
      setError(check.error ?? "Arquivo inválido.");
      return;
    }
    setError(null);
    setFile(chosen);
    setPreviewUrl(URL.createObjectURL(chosen));
  }

  function handleCancel() {
    setFile(null);
    setPreviewUrl(null);
    setError(null);
  }

  async function handleSave() {
    if (!file || saving) return;
    setSaving(true);
    setError(null);
    const result = await saveAvatar(file);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Não foi possível salvar a foto.");
      return;
    }
    setFile(null);
    setPreviewUrl(null);
    setSaved(true);
    router.refresh(); // atualiza Header, perfil e demais lugares que mostram o avatar
  }

  return (
    <div className="flex w-full flex-col items-center gap-1.5">
      {previewUrl ? (
        <Avatar emoji={user.avatarEmoji} color={user.avatarColor} imageUrl={previewUrl} size="lg" />
      ) : (
        <UserAvatar user={user} size="lg" showOnline />
      )}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={AVATAR_ACCEPT}
        onChange={handleChoose}
        className="sr-only"
        tabIndex={-1}
        aria-label="Escolher foto de perfil"
      />

      {!file && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="edkut-link text-xs font-bold"
        >
          {user.avatarUrl ? "alterar foto" : "adicionar foto"}
        </button>
      )}

      {file && (
        <div className="flex flex-col items-center gap-1.5">
          <p className="text-[11px] text-edkut-muted">pré-visualização — ainda não salva</p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="edkut-btn-pink px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "salvando..." : "salvar foto"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="edkut-btn-outline px-3 py-1 text-xs disabled:opacity-60"
            >
              cancelar
            </button>
          </div>
        </div>
      )}

      {!file && !error && !saved && <p className="text-[10px] text-edkut-faint">JPEG, PNG ou WebP · até 2 MB</p>}
      {saved && (
        <p role="status" className="text-[11px] font-semibold text-edkut-green">
          foto atualizada!
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="w-full rounded-edkut border border-edkut-pink bg-edkut-pinkSoft px-2 py-1 text-[11px] text-edkut-pinkDark"
        >
          {error}
        </p>
      )}
    </div>
  );
}
