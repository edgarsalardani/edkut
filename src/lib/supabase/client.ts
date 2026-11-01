import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

/**
 * Cliente Supabase para Client Components (navegador).
 * A sessão fica em cookies (gerenciados pelo @supabase/ssr), o que permite que o
 * servidor e o middleware enxerguem o usuário logado após atualizar a página.
 */
export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
