// ---------------------------------------------------------------------------
// Fotos (Supabase Storage + tabela profile_photos) e vídeos do YouTube (tabela profile_videos) — NAVEGADOR.
//
// Segurança: o dono é sempre o usuário autenticado; o caminho é "<id>/<uuid>.<ext>"; o banco recusa caminho fora da
// pasta do dono (CHECK + policies de Storage). Vídeos guardam só o ID de 11 caracteres (validado aqui e no banco).
// Só a chave pública (anon) é usada. Nenhum segredo.
// ---------------------------------------------------------------------------
import { createClient } from "@/lib/supabase/client";
import { sniffImageType } from "@/lib/avatarUpload";
import { friendlyProfileError, type ExtrasResult } from "@/lib/profileExtras";
import {
  PHOTO_BUCKET,
  PHOTO_CAPTION_MAX,
  PHOTO_LIMIT_PER_USER,
  PHOTO_MAX_BYTES,
  VIDEO_DESCRIPTION_MAX,
  VIDEO_LIMIT_PER_USER,
  VIDEO_TITLE_MAX,
  charLength,
  parseYoutubeId,
  photoPublicUrl,
} from "@/lib/profileClassic";
import type { ProfilePhoto, ProfileVideo } from "@/types";

export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function validatePhotoFile(file: File): Promise<{ ok: boolean; error?: string }> {
  if (!(file.type in EXT)) return { ok: false, error: "Formato não aceito. Envie uma imagem JPEG, PNG ou WebP." };
  if (file.size === 0) return { ok: false, error: "O arquivo está vazio." };
  if (file.size > PHOTO_MAX_BYTES) return { ok: false, error: "A foto é grande demais. O limite é de 5 MB." };
  if ((await sniffImageType(file)) !== file.type) return { ok: false, error: "O arquivo não parece ser uma imagem JPEG, PNG ou WebP válida." };
  return { ok: true };
}

function mediaError(error: { message?: string; code?: string; statusCode?: string | number }, kind: "foto" | "vídeo"): string {
  const m = (error.message ?? "").toLowerCase();
  if (error.code === "54000" || m.includes("media_quota_exceeded")) {
    return kind === "foto" ? `Você atingiu o limite de ${PHOTO_LIMIT_PER_USER} fotos. Apague alguma para enviar outra.` : `Você atingiu o limite de ${VIDEO_LIMIT_PER_USER} vídeos. Apague algum para cadastrar outro.`;
  }
  if (error.code === "23505") return kind === "vídeo" ? "Este vídeo já está no seu perfil." : "Esta foto já foi enviada.";
  if (m.includes("exceeded") || m.includes("too large") || String(error.statusCode) === "413") return "A foto é grande demais. O limite é de 5 MB.";
  if (m.includes("mime") || m.includes("not allowed")) return "Formato não aceito. Envie uma imagem JPEG, PNG ou WebP.";
  if (m.includes("bucket not found")) return "O armazenamento de fotos ainda não foi configurado (migração 14).";
  if (m.includes("row-level security") || m.includes("unauthorized") || m.includes("policy")) return "Sem permissão para esta ação. Confira se a migração 14 foi aplicada e se você está logado.";
  return friendlyProfileError(error);
}

interface PhotoRow { id: string; owner_id: string; path: string; caption: string; created_at: string }

export async function uploadPhoto(file: File, captionInput: string): Promise<ExtrasResult<ProfilePhoto>> {
  const caption = captionInput.replace(/\s+/g, " ").trim();
  if (charLength(caption) > PHOTO_CAPTION_MAX) return { ok: false, error: `A legenda pode ter no máximo ${PHOTO_CAPTION_MAX} caracteres.` };
  try {
    const check = await validatePhotoFile(file);
    if (!check.ok) return { ok: false, error: check.error };
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return { ok: false, error: "Sua sessão expirou. Entre novamente." };

    const unique = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
    const path = `${uid}/${unique}.${EXT[file.type]}`;
    const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
    if (upErr) return { ok: false, error: mediaError(upErr, "foto") };

    const { data, error } = await supabase.from("profile_photos").insert({ path, caption }).select("id, owner_id, path, caption, created_at").single();
    if (error || !data) {
      await supabase.storage.from(PHOTO_BUCKET).remove([path]); // não deixa arquivo órfão
      return { ok: false, error: error ? mediaError(error, "foto") : "Não foi possível salvar a foto." };
    }
    const row = data as unknown as PhotoRow;
    const url = photoPublicUrl((b, p) => supabase.storage.from(b).getPublicUrl(p).data.publicUrl, row.owner_id, row.path);
    if (!url) return { ok: false, error: "Foto salva, mas o endereço não pôde ser montado. Atualize a página." };
    return { ok: true, data: { id: row.id, ownerId: row.owner_id, path: row.path, url, caption: row.caption, createdAt: row.created_at } };
  } catch (e) {
    return { ok: false, error: mediaError(e as { message?: string }, "foto") };
  }
}

/** Apaga o registro (RLS: só o dono) e depois o arquivo. 0 linhas => sem permissão. */
export async function deletePhoto(photo: Pick<ProfilePhoto, "id" | "path" | "ownerId">): Promise<ExtrasResult> {
  try {
    const supabase = createClient();
    const { error, count } = await supabase.from("profile_photos").delete({ count: "exact" }).eq("id", photo.id);
    if (error) return { ok: false, error: mediaError(error, "foto") };
    if (!count) return { ok: false, error: "Não foi possível apagar: a foto já foi removida ou você não é o dono." };
    if (photo.path.startsWith(`${photo.ownerId}/`)) await supabase.storage.from(PHOTO_BUCKET).remove([photo.path]);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mediaError(e as { message?: string }, "foto") };
  }
}

interface VideoRow { id: string; owner_id: string; youtube_id: string; title: string; description: string; created_at: string }

export async function addVideo(urlInput: string, titleInput: string, descriptionInput: string): Promise<ExtrasResult<ProfileVideo>> {
  const youtubeId = parseYoutubeId(urlInput);
  if (!youtubeId) return { ok: false, error: "Cole um link válido do YouTube (youtube.com/watch?v=..., youtu.be/... ou /shorts/...)." };
  const title = titleInput.replace(/\s+/g, " ").trim();
  const description = descriptionInput.replace(/\s+/g, " ").trim();
  if (charLength(title) > VIDEO_TITLE_MAX) return { ok: false, error: `O título pode ter no máximo ${VIDEO_TITLE_MAX} caracteres.` };
  if (charLength(description) > VIDEO_DESCRIPTION_MAX) return { ok: false, error: `A descrição pode ter no máximo ${VIDEO_DESCRIPTION_MAX} caracteres.` };
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profile_videos")
      .insert({ youtube_id: youtubeId, title, description })
      .select("id, owner_id, youtube_id, title, description, created_at")
      .single();
    if (error || !data) return { ok: false, error: error ? mediaError(error, "vídeo") : "Não foi possível salvar o vídeo." };
    const row = data as unknown as VideoRow;
    return { ok: true, data: { id: row.id, ownerId: row.owner_id, youtubeId: row.youtube_id, title: row.title, description: row.description, createdAt: row.created_at } };
  } catch (e) {
    return { ok: false, error: mediaError(e as { message?: string }, "vídeo") };
  }
}

export async function deleteVideo(id: string): Promise<ExtrasResult> {
  try {
    const supabase = createClient();
    const { error, count } = await supabase.from("profile_videos").delete({ count: "exact" }).eq("id", id);
    if (error) return { ok: false, error: mediaError(error, "vídeo") };
    if (!count) return { ok: false, error: "Não foi possível remover: o vídeo já foi removido ou você não é o dono." };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mediaError(e as { message?: string }, "vídeo") };
  }
}
