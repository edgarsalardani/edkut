"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { ProfilePhoto } from "@/types";
import { PHOTO_ACCEPT, deletePhoto, uploadPhoto, validatePhotoFile } from "@/lib/profileMedia";
import { PHOTO_CAPTION_MAX, PHOTO_LIMIT_PER_USER } from "@/lib/profileClassic";
import { formatRelativeTime } from "@/lib/format";

interface ProfilePhotosSectionProps {
  firstName: string;
  isOwnProfile: boolean;
  photos: ProfilePhoto[];
  /** Total real de fotos (pode ser maior que as carregadas). */
  total: number | null;
  unavailable?: boolean;
  onAdded: (photo: ProfilePhoto) => void;
  onRemoved: (id: string) => void;
}

export function ProfilePhotosSection({ firstName, isOwnProfile, photos, total, unavailable = false, onAdded, onRemoved }: ProfilePhotosSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const current = openIndex !== null ? photos[openIndex] : undefined;

  // Esc fecha; setas navegam.
  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openIndex, photos.length]);

  // Se a foto aberta some (apagada), fecha ou ajusta o índice.
  useEffect(() => {
    if (openIndex !== null && openIndex >= photos.length) setOpenIndex(photos.length ? photos.length - 1 : null);
  }, [photos.length, openIndex]);

  function close() {
    setOpenIndex(null);
    setConfirmDelete(false);
  }
  function step(delta: number) {
    setConfirmDelete(false);
    setOpenIndex((i) => (i === null || photos.length === 0 ? i : (i + delta + photos.length) % photos.length));
  }

  async function handleChoose(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    setError(null);
    setNotice(null);
    if (!picked) return setFile(null);
    const check = await validatePhotoFile(picked);
    if (!check.ok) {
      setFile(null);
      setError(check.error ?? "Arquivo inválido.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFile(picked);
  }

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!file || busy.current) return;
    busy.current = true;
    setUploading(true);
    setError(null);
    setNotice(null);
    const result = await uploadPhoto(file, caption);
    busy.current = false;
    setUploading(false);
    if (!result.ok || !result.data) {
      setError(result.error ?? "Não foi possível enviar a foto.");
      return;
    }
    onAdded(result.data);
    setFile(null);
    setCaption("");
    if (inputRef.current) inputRef.current.value = "";
    setNotice("Foto adicionada!");
  }

  async function handleDelete() {
    if (!current || deleting) return;
    setDeleting(true);
    setError(null);
    const result = await deletePhoto(current);
    setDeleting(false);
    if (!result.ok) {
      setError(result.error ?? "Não foi possível apagar a foto.");
      return;
    }
    setConfirmDelete(false);
    onRemoved(current.id);
    setNotice("Foto apagada.");
  }

  const count = total ?? photos.length;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="border-b border-edkut-border pb-1 font-heading text-sm font-bold text-edkut-blue">
        fotos de {firstName} ({total ?? "–"})
      </h2>

      {unavailable && <p role="alert" className="rounded-edkut border border-edkut-pink bg-edkut-pinkSoft px-3 py-2 text-sm text-edkut-pinkDark">As fotos precisam da migração 14 no Supabase. Aplique-a e atualize a página.</p>}

      {isOwnProfile && !unavailable && (
        <form onSubmit={handleUpload} className="flex flex-col gap-2 rounded-edkut border border-edkut-border bg-edkut-blueSoft p-3" aria-label="Enviar foto">
          <label htmlFor="photo-file" className="text-xs font-bold text-edkut-blue">adicionar foto <span className="font-normal text-edkut-muted">(JPEG, PNG ou WebP, até 5 MB; máx. {PHOTO_LIMIT_PER_USER} fotos)</span></label>
          <input id="photo-file" ref={inputRef} type="file" accept={PHOTO_ACCEPT} onChange={handleChoose} disabled={uploading} className="text-xs" />
          <input value={caption} maxLength={PHOTO_CAPTION_MAX} onChange={(e) => setCaption(e.target.value)} className="edkut-input" placeholder="legenda (opcional)" aria-label="Legenda da foto" disabled={uploading} />
          <button type="submit" className="edkut-btn-pink self-start" disabled={!file || uploading}>
            {uploading ? "enviando..." : "enviar foto"}
          </button>
        </form>
      )}

      {error && <p role="alert" className="rounded-edkut border border-edkut-pink bg-edkut-pinkSoft px-3 py-2 text-xs text-edkut-pinkDark">{error}</p>}
      {notice && <p role="status" className="text-xs font-semibold text-edkut-green">{notice}</p>}

      {photos.length === 0 ? (
        <p className="rounded-edkut border border-dashed border-edkut-border p-5 text-center text-sm text-edkut-muted">
          {isOwnProfile ? "Você ainda não adicionou fotos." : `${firstName} ainda não adicionou fotos.`}
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {photos.map((p, i) => (
            <li key={p.id} className="min-w-0">
              <button type="button" onClick={() => setOpenIndex(i)} className="block w-full overflow-hidden rounded-edkut border border-edkut-border bg-white p-0.5 hover:border-edkut-pink" aria-label={p.caption ? `Abrir foto: ${p.caption}` : "Abrir foto"}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption || "foto"} loading="lazy" decoding="async" className="aspect-square w-full object-cover" />
              </button>
              {p.caption && <p className="mt-0.5 line-clamp-1 text-center text-[11px] text-edkut-muted">{p.caption}</p>}
            </li>
          ))}
        </ul>
      )}
      {count > photos.length && <p className="text-[11px] text-edkut-muted">Mostrando as {photos.length} fotos mais recentes de {count}.</p>}

      {current && (
        <div role="dialog" aria-modal="true" aria-label="Foto ampliada" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3" onClick={close}>
          <div className="flex max-h-full w-full max-w-3xl flex-col gap-2 rounded-edkut bg-white p-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center overflow-hidden rounded-edkut bg-edkut-blueSoft">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={current.url} alt={current.caption || "foto"} className="max-h-[65vh] w-auto max-w-full object-contain" />
            </div>
            {current.caption && <p className="break-words text-sm text-edkut-text">{current.caption}</p>}
            <p className="text-[11px] text-edkut-faint">foto {(openIndex ?? 0) + 1} de {photos.length} · {formatRelativeTime(current.createdAt)}</p>
            <div className="flex flex-wrap items-center gap-2">
              {photos.length > 1 && (
                <>
                  <button type="button" className="edkut-btn-outline px-3 py-1 text-xs" onClick={() => step(-1)}>‹ anterior</button>
                  <button type="button" className="edkut-btn-outline px-3 py-1 text-xs" onClick={() => step(1)}>próxima ›</button>
                </>
              )}
              {isOwnProfile && !confirmDelete && (
                <button type="button" className="edkut-link text-xs font-bold" onClick={() => setConfirmDelete(true)}>excluir foto</button>
              )}
              {isOwnProfile && confirmDelete && (
                <span className="flex items-center gap-2 text-xs">
                  <span className="text-edkut-muted">Apagar esta foto?</span>
                  <button type="button" className="font-bold text-edkut-pinkDark hover:underline" onClick={handleDelete} disabled={deleting}>{deleting ? "apagando..." : "sim, apagar"}</button>
                  <button type="button" className="edkut-link" onClick={() => setConfirmDelete(false)} disabled={deleting}>cancelar</button>
                </span>
              )}
              <button type="button" className="edkut-btn ml-auto px-3 py-1 text-xs" onClick={close}>fechar</button>
            </div>
            {error && <p role="alert" className="text-xs text-edkut-pinkDark">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
