// ---------------------------------------------------------------------------
// Sessão mockada. O EdKut V1 não tem backend nem autenticação real: o botão
// "entrar" da tela de login sempre acessa o usuário de demonstração
// (ver src/mocks/users.ts -> DEMO_USER_ID). Este arquivo só guarda uma
// flag local para a experiência de login/logout parecer real.
//
// Quando existir autenticação de verdade, troque isso por um provider
// (ex: NextAuth, JWT em cookie httpOnly, etc.) mantendo a mesma API:
// login(), logout(), isLoggedIn().
// ---------------------------------------------------------------------------

const SESSION_KEY = "edkut_session";

export function login(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_KEY, "1");
}

export function logout(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
}

export function isLoggedIn(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SESSION_KEY) === "1";
}
