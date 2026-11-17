// ---------------------------------------------------------------------------
// Perfil "clássico": regras PURAS (sem rede) — status, dados pessoais, YouTube, escala de indicadores.
// Os limites espelham os CHECKs da migração 14; quem de fato garante é o banco.
// ---------------------------------------------------------------------------
import type { ProfileExtras, RelationshipKey, TechProfileScore } from "@/types";

export const STATUS_MAX = 100;
export const HOBBIES_MAX = 300;
export const PHOTO_CAPTION_MAX = 140;
export const VIDEO_TITLE_MAX = 100;
export const VIDEO_DESCRIPTION_MAX = 300;
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_LIMIT_PER_USER = 100;
export const VIDEO_LIMIT_PER_USER = 50;

export const RELATIONSHIP_LABEL: Record<RelationshipKey, string> = {
  solteiro: "solteiro(a)",
  namorando: "namorando",
  casado: "casado(a)",
  uniao_estavel: "união estável",
  relacionamento_aberto: "relacionamento aberto",
  complicado: "é complicado",
};
export const RELATIONSHIP_KEYS = Object.keys(RELATIONSHIP_LABEL) as RelationshipKey[];

export function charLength(value: string): number {
  return Array.from(value).length;
}

/** Status: espaços são aparados; vazio => null (remove o status). */
export function validateStatus(input: string): { ok: boolean; value: string | null; error?: string } {
  const value = input.replace(/\s+/g, " ").trim();
  if (value === "") return { ok: true, value: null };
  if (charLength(value) > STATUS_MAX) return { ok: false, value: null, error: `A frase de status pode ter no máximo ${STATUS_MAX} caracteres.` };
  return { ok: true, value };
}

export interface ExtrasInput {
  relationship: string;
  birthday: string;
  hobbies: string;
}

export interface CleanExtras {
  relationship: RelationshipKey | null;
  birthday: string | null;
  hobbies: string | null;
}

/** Hoje como AAAA-MM-DD no fuso do navegador (só para impedir data futura). */
function todayIso(now: Date): string {
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

export function isValidIsoDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function validateExtras(input: ExtrasInput, now: Date = new Date()): { ok: boolean; clean?: CleanExtras; error?: string } {
  const rel = input.relationship.trim();
  if (rel && !RELATIONSHIP_KEYS.includes(rel as RelationshipKey)) return { ok: false, error: "Escolha uma opção de relacionamento da lista." };
  const birthday = input.birthday.trim();
  if (birthday) {
    if (!isValidIsoDate(birthday)) return { ok: false, error: "Data de aniversário inválida." };
    if (birthday < "1900-01-01") return { ok: false, error: "O ano do aniversário deve ser 1900 ou depois." };
    if (birthday > todayIso(now)) return { ok: false, error: "A data de aniversário não pode estar no futuro." };
  }
  const hobbies = input.hobbies.replace(/\r\n/g, "\n").trim();
  if (charLength(hobbies) > HOBBIES_MAX) return { ok: false, error: `Os hobbies podem ter no máximo ${HOBBIES_MAX} caracteres.` };
  return { ok: true, clean: { relationship: (rel || null) as RelationshipKey | null, birthday: birthday || null, hobbies: hobbies || null } };
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "1990-04-12" => "12 de abril" (o ano nunca é exibido). Sem usar Date: sem deslocamento de fuso. */
export function formatBirthday(iso: string | undefined): string | undefined {
  if (!iso || !isValidIsoDate(iso)) return undefined;
  const [, m, d] = iso.split("-").map(Number);
  return `${d} de ${MONTHS[m - 1]}`;
}

// ------------------------------ YouTube ------------------------------

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const YT_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"]);

/**
 * Extrai o id de um link do YouTube (watch?v=, youtu.be/, /embed/, /shorts/, /live/, /v/). Devolve null para qualquer
 * outro endereço (outros sites, esquemas diferentes de http/https, lookalikes como "youtube.com.evil.com").
 * Aceita também o id puro de 11 caracteres.
 */
export function parseYoutubeId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (YT_ID.test(raw)) return raw;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  let id: string | null = null;
  if (host === "youtu.be" || host === "www.youtu.be") {
    id = url.pathname.split("/")[1] ?? null;
  } else if (YT_HOSTS.has(host)) {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "watch") id = url.searchParams.get("v");
    else if (["embed", "shorts", "live", "v"].includes(parts[0] ?? "")) id = parts[1] ?? null;
  }
  return id && YT_ID.test(id) ? id : null;
}

export const youtubeThumbnailUrl = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const youtubeEmbedUrl = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
export const youtubeWatchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;

// ------------------------------ fotos ------------------------------

export const PHOTO_BUCKET = "profile-photos";

/** URL pública de uma foto, só se o caminho for da pasta do dono (mesmo formato exigido pelo banco). */
export function photoPublicUrl(getPublicUrl: (bucket: string, path: string) => string, ownerId: string, path: string | null | undefined): string | undefined {
  if (!path || !path.startsWith(`${ownerId}/`)) return undefined;
  if (!/^[A-Za-z0-9._-]+\.(jpg|png|webp)$/.test(path.slice(ownerId.length + 1))) return undefined;
  return getPublicUrl(PHOTO_BUCKET, path);
}

// ------------------------------ indicadores clássicos ------------------------------

export type ClassicIconKind = "smile" | "cube" | "heart";

/**
 * Indicadores sociais no estilo do Orkut, alimentados pelas avaliações que JÁ existem (friend_ratings, migração 9):
 * a média 0–100 de cada dimensão vira de 0 a 3 símbolos preenchidos. NENHUM dado novo: para trocar os rótulos ou
 * a associação símbolo⇄dimensão, é só editar esta lista.
 */
export const CLASSIC_INDICATORS: { key: keyof TechProfileScore; label: string; icon: ClassicIconKind; hint: string }[] = [
  { key: "parceiro", label: "parceiro", icon: "smile", hint: "visto como colaborativo e disposto a ajudar" },
  { key: "nerd", label: "nerd", icon: "cube", hint: "identificação com a cultura de Computação e Tecnologia" },
  { key: "tech", label: "tech", icon: "heart", hint: "visto como ligado ao universo da tecnologia" },
];

/** 0–100 => 0–3 símbolos (arredonda ao mais próximo: 17→1, 50→2, 84→3). Valores fora da faixa são limitados. */
export function scoreToLevel(score: number): number {
  if (!Number.isFinite(score)) return 0;
  const clamped = Math.min(100, Math.max(0, score));
  return Math.min(3, Math.round((clamped / 100) * 3));
}

// ------------------------------ informações pessoais ------------------------------

export interface InfoRow {
  label: string;
  value: string;
  /** Quando presente, a linha mostra etiquetas (interesses) em vez de texto. */
  tags?: string[];
}

/** Linhas do quadro "informações pessoais", só com o que existe (campos vazios não aparecem). */
export function buildInfoRows(args: {
  extras: ProfileExtras;
  userTypeLabel: string;
  location?: string;
  bio?: string;
  interests?: string[];
  institution?: string;
  courseOrArea?: string;
  joinedAt: string;
}): InfoRow[] {
  const rows: InfoRow[] = [];
  if (args.extras.relationship) rows.push({ label: "relacionamento", value: RELATIONSHIP_LABEL[args.extras.relationship] });
  const bday = formatBirthday(args.extras.birthday);
  if (bday) rows.push({ label: "aniversário", value: bday });
  if (args.location) rows.push({ label: "cidade / estado / país", value: args.location });
  if (args.bio) rows.push({ label: "quem sou eu", value: args.bio });
  if (args.interests && args.interests.length > 0) rows.push({ label: "interesses", value: args.interests.join(", "), tags: args.interests });
  if (args.extras.hobbies) rows.push({ label: "hobbies", value: args.extras.hobbies });
  rows.push({ label: "tipo", value: args.userTypeLabel });
  if (args.institution) rows.push({ label: "formação", value: args.institution });
  if (args.courseOrArea) rows.push({ label: "área de atuação", value: args.courseOrArea });
  const joined = new Date(args.joinedAt);
  if (!Number.isNaN(joined.getTime())) rows.push({ label: "membro desde", value: joined.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) });
  return rows;
}

// ----- navegação: aba aberta no perfil (?aba=) -----
export type ProfileTab = "perfil" | "recados" | "fotos" | "videos" | "depoimentos";

/** Valida a aba pedida na URL (?aba=fotos), usada pelos atalhos da Home. Qualquer outro valor cai em "perfil". */
export function parseInitialTab(value: string | undefined): ProfileTab {
  return value === "recados" || value === "fotos" || value === "videos" || value === "depoimentos" ? value : "perfil";
}
