// ---------------------------------------------------------------------------
// Variáveis públicas do Supabase. Só a URL e a chave PÚBLICA (anon/publishable)
// são lidas aqui — a segurança dos dados vem das policies de RLS, não do sigilo
// dessa chave. A chave service_role NUNCA é lida em código do app.
//
// IMPORTANTE: o Next.js só embute variáveis NEXT_PUBLIC_* no navegador quando o
// acesso é literal (process.env.NEXT_PUBLIC_X). Por isso não use process.env[nome].
// ---------------------------------------------------------------------------

export function getSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Variáveis do Supabase ausentes. Crie o arquivo .env.local a partir do .env.example e preencha " +
        "NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY (Supabase > Project Settings > API). " +
        "Depois reinicie o servidor (npm run dev)."
    );
  }
  return { url, anonKey };
}
