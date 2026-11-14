const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Usuários REAIS (Supabase) têm id UUID; os fictícios dos mocks são "u1", "u2"... */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
