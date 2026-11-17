"use client";

import { FormEvent, useRef, useState } from "react";
import { ProfileVideo } from "@/types";
import { addVideo, deleteVideo } from "@/lib/profileMedia";
import { VIDEO_DESCRIPTION_MAX, VIDEO_LIMIT_PER_USER, VIDEO_TITLE_MAX, youtubeEmbedUrl, youtubeThumbnailUrl, youtubeWatchUrl } from "@/lib/profileClassic";

interface ProfileVideosSectionProps {
  firstName: string;
  isOwnProfile: boolean;
  videos: ProfileVideo[];
  total: number | null;
  unavailable?: boolean;
  onAdded: (video: ProfileVideo) => void;
  onRemoved: (id: string) => void;
}

function Thumb({ id, title }: { id: string; title: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="flex aspect-video w-full items-center justify-center bg-edkut-blueSoft text-2xl text-edkut-faint" aria-hidden>▶</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={youtubeThumbnailUrl(id)} alt={title || "miniatura do vídeo"} loading="lazy" decoding="async" onError={() => setFailed(true)} className="aspect-video w-full object-cover" />;
}

/** Vídeos por link do YouTube. Guardamos só o id; miniatura e player (youtube-nocookie, sandbox) são montados aqui. */
export function ProfileVideosSection({ firstName, isOwnProfile, videos, total, unavailable = false, onAdded, onRemoved }: ProfileVideosSectionProps) {
  const busy = useRef(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    setNotice(null);
    const result = await addVideo(url, title, description);
    busy.current = false;
    setSaving(false);
    if (!result.ok || !result.data) {
      setError(result.error ?? "Não foi possível adicionar o vídeo.");
      return;
    }
    onAdded(result.data);
    setUrl("");
    setTitle("");
    setDescription("");
    setNotice("Vídeo adicionado!");
  }

  async function handleDelete(v: ProfileVideo) {
    if (deleting) return;
    setDeleting(v.id);
    setError(null);
    const result = await deleteVideo(v.id);
    setDeleting(null);
    if (!result.ok) {
      setError(result.error ?? "Não foi possível remover o vídeo.");
      return;
    }
    setConfirming(null);
    if (playing === v.id) setPlaying(null);
    onRemoved(v.id);
    setNotice("Vídeo removido.");
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="border-b border-edkut-border pb-1 font-heading text-sm font-bold text-edkut-blue">
        vídeos de {firstName} ({total ?? "–"})
      </h2>

      {unavailable && <p role="alert" className="rounded-edkut border border-edkut-pink bg-edkut-pinkSoft px-3 py-2 text-sm text-edkut-pinkDark">Os vídeos precisam da migração 14 no Supabase. Aplique-a e atualize a página.</p>}

      {isOwnProfile && !unavailable && (
        <form onSubmit={handleAdd} className="flex flex-col gap-2 rounded-edkut border border-edkut-border bg-edkut-blueSoft p-3" aria-label="Adicionar vídeo">
          <label htmlFor="video-url" className="text-xs font-bold text-edkut-blue">adicionar vídeo do YouTube <span className="font-normal text-edkut-muted">(cole o link; máx. {VIDEO_LIMIT_PER_USER} vídeos)</span></label>
          <input id="video-url" value={url} onChange={(e) => { setUrl(e.target.value); setError(null); }} className="edkut-input" placeholder="https://www.youtube.com/watch?v=..." disabled={saving} inputMode="url" autoComplete="off" />
          <input value={title} maxLength={VIDEO_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} className="edkut-input" placeholder="título (opcional)" aria-label="Título do vídeo" disabled={saving} />
          <input value={description} maxLength={VIDEO_DESCRIPTION_MAX} onChange={(e) => setDescription(e.target.value)} className="edkut-input" placeholder="descrição (opcional)" aria-label="Descrição do vídeo" disabled={saving} />
          <button type="submit" className="edkut-btn-pink self-start" disabled={saving || !url.trim()}>{saving ? "adicionando..." : "adicionar vídeo"}</button>
        </form>
      )}

      {error && <p role="alert" className="rounded-edkut border border-edkut-pink bg-edkut-pinkSoft px-3 py-2 text-xs text-edkut-pinkDark">{error}</p>}
      {notice && <p role="status" className="text-xs font-semibold text-edkut-green">{notice}</p>}

      {videos.length === 0 ? (
        <p className="rounded-edkut border border-dashed border-edkut-border p-5 text-center text-sm text-edkut-muted">
          {isOwnProfile ? "Você ainda não adicionou vídeos." : `${firstName} ainda não adicionou vídeos.`}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {videos.map((v) => (
            <li key={v.id} className="flex min-w-0 flex-col gap-1 rounded-edkut border border-edkut-border bg-white p-2">
              {playing === v.id ? (
                <div className="aspect-video w-full overflow-hidden rounded-edkut bg-black">
                  <iframe
                    src={youtubeEmbedUrl(v.youtubeId)}
                    title={v.title || "Vídeo do YouTube"}
                    className="h-full w-full"
                    loading="lazy"
                    allow="encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                    sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                  />
                </div>
              ) : (
                <button type="button" onClick={() => setPlaying(v.id)} className="relative block overflow-hidden rounded-edkut" aria-label={`Reproduzir vídeo${v.title ? `: ${v.title}` : ""}`}>
                  <Thumb id={v.youtubeId} title={v.title} />
                  <span aria-hidden className="absolute inset-0 flex items-center justify-center text-3xl text-white drop-shadow">▶</span>
                </button>
              )}
              <p className="break-words font-heading text-sm font-bold text-edkut-blue">{v.title || "vídeo sem título"}</p>
              {v.description && <p className="break-words text-xs text-edkut-muted">{v.description}</p>}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <a href={youtubeWatchUrl(v.youtubeId)} target="_blank" rel="noopener noreferrer" className="edkut-link">abrir no YouTube</a>
                {playing === v.id && <button type="button" className="edkut-link" onClick={() => setPlaying(null)}>fechar player</button>}
                {isOwnProfile && confirming !== v.id && <button type="button" className="edkut-link font-bold" onClick={() => setConfirming(v.id)}>excluir</button>}
                {isOwnProfile && confirming === v.id && (
                  <span className="flex items-center gap-2">
                    <span className="text-edkut-muted">Remover?</span>
                    <button type="button" className="font-bold text-edkut-pinkDark hover:underline" onClick={() => void handleDelete(v)} disabled={deleting !== null}>{deleting === v.id ? "removendo..." : "sim, remover"}</button>
                    <button type="button" className="edkut-link" onClick={() => setConfirming(null)} disabled={deleting !== null}>cancelar</button>
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {(total ?? 0) > videos.length && <p className="text-[11px] text-edkut-muted">Mostrando os {videos.length} vídeos mais recentes de {total}.</p>}
    </div>
  );
}
