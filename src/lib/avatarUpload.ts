// ---------------------------------------------------------------------------
// Foto de perfil: validação e envio para o Supabase Storage (NAVEGADOR).
//
// Segurança:
//  - o dono é SEMPRE o usuário autenticado (auth.getUser()); o caminho é "<id>/<arquivo>";
//  - quem de fato impede gravar na pasta de outra pessoa são as policies de storage.objects e o
//    CHECK de profiles.avatar_path (supabase/migrations/20261114140001_avatars_storage.sql);
//  - o perfil guarda só o CAMINHO ("<id>/<arquivo>"), nunca uma URL: o endereço é montado pelo
//    app com o domínio do próprio projeto (ver services/authService.ts);
//  - o limite de 2 MB e os tipos permitidos também são impostos pelo bucket (servidor);
//  - só a chave pública (anon) é usada. Nenhuma chave secreta.
// ---------------------------------------------------------------------------
import { createClient } from "@/lib/supabase/client";

export const AVATAR_BUCKET = "avatars";
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
export const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp";

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

/** Confere o tipo real do arquivo pelos primeiros bytes (não só pela extensão/MIME informado). */
async function sniffImageType(file: File): Promise<string | null> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const ascii = (from: number, to: number) => String.fromCharCode(...Array.from(head.slice(from, to)));
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  if (head[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function validateAvatarFile(file: File): Promise<ValidationResult> {
  if (!(file.type in EXT_BY_TYPE)) {
    return { ok: false, error: "Formato não aceito. Envie uma imagem JPEG, PNG ou WebP." };
  }
  if (file.size === 0) {
    return { ok: false, error: "O arquivo está vazio." };
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { ok: false, error: "A imagem é grande demais. O limite é de 2 MB." };
  }
  const real = await sniffImageType(file);
  if (real !== file.type) {
    return { ok: false, error: "O arquivo não parece ser uma imagem JPEG, PNG ou WebP válida." };
  }
  return { ok: true };
}

function friendlyStorageError(error: { message?: string; statusCode?: string | number }): string {
  const message = (error.message ?? "").toLowerCase();
  if (message.includes("exceeded") || message.includes("too large") || String(error.statusCode) === "413") {
    return "A imagem é grande demais. O limite é de 2 MB.";
  }
  if (message.includes("mime") || message.includes("not allowed")) {
    return "Formato não aceito. Envie uma imagem JPEG, PNG ou WebP.";
  }
  if (message.includes("row-level security") || message.includes("unauthorized") || message.includes("policy")) {
    return "Sem permissão para enviar a foto. Confira se a migração de Storage foi aplicada e se você está logado.";
  }
  if (message.includes("bucket not found")) {
    return "O armazenamento de fotos ainda não foi configurado no Supabase (bucket 'avatars').";
  }
  if (message.includes("failed to fetch") || message.includes("network")) {
    return "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.";
  }
  return "Não foi possível salvar a foto. Tente novamente.";
}

export interface SaveAvatarResult {
  ok: boolean;
  error?: string;
}

/**
 * Envia a imagem, grava o caminho em profiles.avatar_path do usuário autenticado e
 * apaga a foto anterior (melhor esforço). Cada envio usa um nome novo, o que evita cache antigo.
 */
export async function saveAvatar(file: File): Promise<SaveAvatarResult> {
  try {
    const check = await validateAvatarFile(file);
    if (!check.ok) return check;

    const supabase = createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      return { ok: false, error: "Sua sessão expirou. Entre novamente para alterar a foto." };
    }
    const userId = auth.user.id;

    const unique =
      typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
    const path = `${userId}/${unique}.${EXT_BY_TYPE[file.type]}`;

    const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });
    if (uploadError) return { ok: false, error: friendlyStorageError(uploadError) };

    // Foto anterior, lida do banco (fonte confiável) antes de trocar.
    const { data: before } = await supabase.from("profiles").select("avatar_path").eq("id", userId).maybeSingle();
    const oldPath = (before as { avatar_path?: string | null } | null)?.avatar_path ?? null;

    const { error: updateError } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", userId);
    if (updateError) {
      // Não deixa arquivo órfão se o perfil não foi atualizado.
      await supabase.storage.from(AVATAR_BUCKET).remove([path]);
      const msg = (updateError.message ?? "").toLowerCase();
      if (msg.includes("permission denied")) {
        return {
          ok: false,
          error: "Sem permissão para atualizar o perfil. Confira se a migração de Storage foi aplicada.",
        };
      }
      return { ok: false, error: "Não foi possível atualizar seu perfil com a nova foto. Tente novamente." };
    }

    // Apaga a foto anterior, só se for da própria pasta do usuário.
    if (oldPath && oldPath.startsWith(`${userId}/`) && oldPath !== path) {
      await supabase.storage.from(AVATAR_BUCKET).remove([oldPath]);
    }

    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Variáveis do Supabase ausentes")) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: friendlyStorageError(e as { message?: string }) };
  }
}
