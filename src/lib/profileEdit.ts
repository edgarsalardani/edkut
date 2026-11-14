// ---------------------------------------------------------------------------
// Edição do perfil: validação (espelha as constraints de public.profiles), checagem de username e
// gravação no Supabase (NAVEGADOR).
//
// Segurança: quem garante "só o dono edita" e "campos protegidos" é o BANCO (RLS profiles_update_own +
// grants por coluna da migração 2). Aqui só enviamos as colunas editáveis e filtramos por .eq("id", <usuário autenticado>).
// E-mail e senha NÃO passam por aqui (ficam no Supabase Auth). A foto usa lib/avatarUpload.ts (não duplicada).
// ---------------------------------------------------------------------------
import { createClient } from "@/lib/supabase/client";
import type { UserType } from "@/types";

/** Limites iguais aos CHECKs de public.profiles (migração 2). Comprimentos em CARACTERES (code points), como o Postgres. */
export const PROFILE_LIMITS = {
  nameMin: 2,
  nameMax: 80,
  usernameMin: 3,
  usernameMax: 30,
  headlineMax: 120,
  bioMax: 500,
  institutionMax: 120,
  courseMax: 120,
  locationMax: 120,
  interestsMaxItems: 20,
  interestsMaxTotal: 600, // char_length(array_to_string(interests, ','))
  interestMaxLength: 40, // limite de interface (o banco só limita o total)
} as const;

export const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const USER_TYPES: readonly UserType[] = ["professor", "estudante", "egresso", "profissional"];

export const AVATAR_EMOJIS = ["🙂", "😎", "🤓", "🧑‍💻", "👩‍💻", "🧑‍🏫", "🎨", "🤖", "🛡️", "📚", "🚀", "🐧", "🎮", "☕", "🦊", "🌟"];
export const AVATAR_COLORS = ["#1D4E89", "#D81B85", "#3FA66B", "#E08A1E", "#7A4FB5", "#2A9DB8", "#C0392B", "#5D6D7E"];

export interface ProfileFormValues {
  name: string;
  username: string;
  userType: UserType;
  headline: string;
  bio: string;
  institution: string;
  courseOrArea: string;
  location: string;
  /** Interesses separados por vírgula (ou ponto e vírgula / quebra de linha). */
  interestsText: string;
  avatarEmoji: string;
  avatarColor: string;
}

/** Colunas de public.profiles que este formulário grava (todas editáveis pelo grant da migração 2). */
export interface CleanProfile {
  name: string;
  username: string;
  user_type: UserType;
  headline: string;
  bio: string;
  institution: string | null;
  course_or_area: string | null;
  location: string | null;
  interests: string[];
  avatar_emoji: string;
  avatar_color: string;
}

export type FieldErrors = Partial<Record<keyof ProfileFormValues, string>>;

export interface ValidationResult {
  ok: boolean;
  errors: FieldErrors;
  clean?: CleanProfile;
}

/** Tamanho em caracteres Unicode (code points), igual ao char_length do Postgres. */
export function charLength(value: string): number {
  return Array.from(value).length;
}

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** "IHC, ia ; Web\nIHC" -> ["IHC", "ia", "Web"] (sem vazios nem repetidos, ignorando maiúsculas). */
export function parseInterests(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of text.split(/[,;\n]/)) {
    const item = collapse(collapse(raw).replace(/^#+/, ""));
    if (!item) continue;
    const key = item.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

export function validateProfile(values: ProfileFormValues): ValidationResult {
  const L = PROFILE_LIMITS;
  const errors: FieldErrors = {};

  const name = collapse(values.name);
  if (charLength(name) < L.nameMin || charLength(name) > L.nameMax) {
    errors.name = `O nome deve ter de ${L.nameMin} a ${L.nameMax} caracteres.`;
  }

  const username = values.username.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(username)) {
    errors.username = `O username deve ter de ${L.usernameMin} a ${L.usernameMax} caracteres: letras minúsculas, números, ponto ou _ (sem espaços).`;
  }

  if (!USER_TYPES.includes(values.userType)) errors.userType = "Escolha um tipo de perfil válido.";

  const headline = collapse(values.headline);
  if (charLength(headline) > L.headlineMax) errors.headline = `A frase de apresentação pode ter até ${L.headlineMax} caracteres.`;

  const bio = values.bio.replace(/\r\n/g, "\n").trim();
  if (charLength(bio) > L.bioMax) errors.bio = `A biografia pode ter até ${L.bioMax} caracteres.`;

  const institution = collapse(values.institution);
  if (charLength(institution) > L.institutionMax) errors.institution = `A instituição pode ter até ${L.institutionMax} caracteres.`;
  const course = collapse(values.courseOrArea);
  if (charLength(course) > L.courseMax) errors.courseOrArea = `O curso/área pode ter até ${L.courseMax} caracteres.`;
  const location = collapse(values.location);
  if (charLength(location) > L.locationMax) errors.location = `A localização pode ter até ${L.locationMax} caracteres.`;

  const interests = parseInterests(values.interestsText);
  if (interests.length > L.interestsMaxItems) {
    errors.interestsText = `Informe no máximo ${L.interestsMaxItems} interesses.`;
  } else if (interests.some((i) => charLength(i) > L.interestMaxLength)) {
    errors.interestsText = `Cada interesse pode ter até ${L.interestMaxLength} caracteres.`;
  } else if (charLength(interests.join(",")) > L.interestsMaxTotal) {
    errors.interestsText = `Os interesses somam caracteres demais (máximo ${L.interestsMaxTotal} no total). Remova alguns.`;
  }

  const emojiLen = charLength(values.avatarEmoji);
  if (emojiLen < 1 || emojiLen > 8) errors.avatarEmoji = "Escolha um emoji para o avatar.";
  if (!COLOR_PATTERN.test(values.avatarColor)) errors.avatarColor = "Escolha uma cor válida para o avatar.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    errors,
    clean: {
      name,
      username,
      user_type: values.userType,
      headline,
      bio,
      institution: institution || null,
      course_or_area: course || null,
      location: location || null,
      interests,
      avatar_emoji: values.avatarEmoji,
      avatar_color: values.avatarColor,
    },
  };
}

export type UsernameStatus = "available" | "taken" | "error";

/**
 * Pergunta ao banco se o username já é de OUTRA pessoa (profiles é legível por qualquer usuário logado).
 * É só uma checagem de CONFORTO (aviso antecipado): a garantia contra corrida é o índice único
 * profiles_username_key, tratado em saveProfile.
 */
export async function checkUsernameAvailable(username: string, currentUserId: string): Promise<UsernameStatus> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username.trim().toLowerCase())
      .neq("id", currentUserId)
      .limit(1);
    if (error) return "error";
    return Array.isArray(data) && data.length > 0 ? "taken" : "available";
  } catch {
    return "error";
  }
}

export interface SaveProfileResult {
  ok: boolean;
  /** Mensagem geral (quando não é de um campo específico). */
  error?: string;
  fieldErrors?: FieldErrors;
}

interface PgErrorLike {
  message?: string;
  code?: string;
  details?: string;
}

const CONSTRAINT_FIELD: Record<string, { field: keyof ProfileFormValues; message: string }> = {
  profiles_username_format: { field: "username", message: "Username inválido: use 3 a 30 caracteres (letras minúsculas, números, ponto ou _)." },
  profiles_name_len: { field: "name", message: "O nome deve ter de 2 a 80 caracteres." },
  profiles_headline_len: { field: "headline", message: "A frase de apresentação excede o limite." },
  profiles_bio_len: { field: "bio", message: "A biografia excede o limite." },
  profiles_institution_len: { field: "institution", message: "A instituição excede o limite." },
  profiles_course_len: { field: "courseOrArea", message: "O curso/área excede o limite." },
  profiles_location_len: { field: "location", message: "A localização excede o limite." },
  profiles_interests_size: { field: "interestsText", message: "Há interesses demais ou texto longo demais." },
  profiles_avatar_emoji_len: { field: "avatarEmoji", message: "Emoji inválido." },
  profiles_avatar_color_hex: { field: "avatarColor", message: "Cor inválida." },
};

/** Traduz erros do Postgres/PostgREST para mensagens por campo. */
export function mapProfileSaveError(error: PgErrorLike): SaveProfileResult {
  const text = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();

  if (error.code === "23505" || text.includes("profiles_username_key")) {
    return {
      ok: false,
      fieldErrors: { username: "Este username já está em uso (talvez tenha acabado de ser escolhido por outra pessoa). Escolha outro." },
    };
  }
  if (error.code === "23514") {
    for (const [constraint, info] of Object.entries(CONSTRAINT_FIELD)) {
      if (text.includes(constraint)) return { ok: false, fieldErrors: { [info.field]: info.message } };
    }
    return { ok: false, error: "Algum campo não atende às regras de formato. Revise os dados." };
  }
  if (error.code === "42501" || text.includes("permission denied") || text.includes("row-level security")) {
    return { ok: false, error: "Você não tem permissão para alterar este perfil." };
  }
  if (text.includes("failed to fetch") || text.includes("network")) {
    return { ok: false, error: "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente." };
  }
  return { ok: false, error: "Não foi possível salvar as alterações. Tente novamente." };
}

/** Grava o perfil do usuário AUTENTICADO (o id vem da sessão, nunca do formulário). */
export async function saveProfile(clean: CleanProfile): Promise<SaveProfileResult> {
  try {
    const supabase = createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return { ok: false, error: "Sua sessão expirou. Entre novamente para editar o perfil." };

    const { data, error } = await supabase.from("profiles").update(clean).eq("id", auth.user.id).select("id");
    if (error) return mapProfileSaveError(error);
    if (!Array.isArray(data) || data.length === 0) {
      return { ok: false, error: "Não foi possível localizar o seu perfil para atualizar." };
    }
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Variáveis do Supabase ausentes")) return { ok: false, error: e.message };
    return mapProfileSaveError(e as PgErrorLike);
  }
}
