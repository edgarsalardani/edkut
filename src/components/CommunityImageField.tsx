"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { validateAvatarFile } from "@/lib/avatarUpload";
import { COMMUNITY_IMAGE_ACCEPT } from "@/lib/communities";

interface CommunityImageFieldProps {
  /** Aparência atual (emoji, cor e, se houver, a imagem já salva). */
  emoji: string;
  color: string;
  currentImageUrl?: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  /** Só na edição: marca a imagem atual para remoção. */
  removeRequested?: boolean;
  onRemoveChange?: (remove: boolean) => void;
  disabled?: boolean;
}

/** Escolha da imagem da comunidade (JPEG/PNG/WebP até 2 MB, conferida pelo conteúdo). Opcional. */
export function CommunityImageField({
  emoji,
  color,
  currentImageUrl,
  file,
  onFileChange,
  removeRequested = false,
  onRemoveChange,
  disabled = false,
}: CommunityImageFieldProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    setError(null);
    if (!picked) return;
    const check = await validateAvatarFile(picked);
    if (!check.ok) {
      setError(check.error ?? "Arquivo inválido.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    onRemoveChange?.(false);
    onFileChange(picked);
  }

  function clearSelection() {
    onFileChange(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const shownUrl = preview ?? (removeRequested ? undefined : currentImageUrl);

  return (
    <div className="flex items-start gap-3">
      <Avatar emoji={emoji} color={color} imageUrl={shownUrl} size="lg" />
      <div className="min-w-0 flex-1 text-sm">
        <label htmlFor="community-image-input" className="font-semibold text-edkut-text">
          imagem da comunidade <span className="font-normal text-edkut-muted">(opcional)</span>
        </label>
        <input
          id="community-image-input"
          ref={inputRef}
          type="file"
          accept={COMMUNITY_IMAGE_ACCEPT}
          onChange={handleChange}
          disabled={disabled}
          className="mt-1 block w-full text-xs"
        />
        <p className="mt-1 text-[11px] text-edkut-muted">JPEG, PNG ou WebP, até 2 MB. Sem imagem, a comunidade usa o emoji e a cor padrão.</p>
        {error && (
          <p role="alert" className="mt-1 text-xs text-edkut-pinkDark">
            {error}
          </p>
        )}
        <div className="mt-1 flex gap-3 text-xs">
          {file && (
            <button type="button" className="edkut-link" onClick={clearSelection} disabled={disabled}>
              descartar escolha
            </button>
          )}
          {onRemoveChange && currentImageUrl && !file && (
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={removeRequested} onChange={(e) => onRemoveChange(e.target.checked)} disabled={disabled} />
              remover a imagem atual
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
