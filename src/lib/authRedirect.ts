// ---------------------------------------------------------------------------
// Destinos permitidos após /auth/callback (parâmetro `next`).
//
// Usamos uma LISTA FIXA (e não "qualquer caminho relativo") para evitar open redirect:
// valores como "//evil.com", "/\evil.com", "https://evil.com" ou "/qualquer/outra/rota"
// caem no destino padrão.
// ---------------------------------------------------------------------------

export const DEFAULT_AFTER_AUTH_PATH = "/home";
export const RESET_PASSWORD_PATH = "/auth/reset-password";

const ALLOWED_NEXT_PATHS: readonly string[] = [DEFAULT_AFTER_AUTH_PATH, RESET_PASSWORD_PATH];

export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_AFTER_AUTH_PATH;
  return ALLOWED_NEXT_PATHS.includes(raw) ? raw : DEFAULT_AFTER_AUTH_PATH;
}
