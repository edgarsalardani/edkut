-- =============================================================================
-- EdKut — Teste de fumaça da BUSCA DE PESSOAS (nenhuma migração nova é necessária)
--
-- Confere, no banco, o que a busca do app (src/services/authService.ts → searchProfilesByText) exige:
--   * usuário autenticado lê profiles (nome/username/foto); `anon` não lê nada;
--   * ILIKE por nome e por username, com curingas escapados (% _ \) tratados como texto;
--   * nenhuma coluna privada (e-mail/senha) em profiles;
--   * solicitações de amizade pendentes só são visíveis às duas partes (estado do botão na lista).
-- Rode SOMENTE em projeto de DESENVOLVIMENTO, no SQL Editor, o arquivo inteiro. Termina em ROLLBACK.
-- Esperado: várias mensagens "OK: ..." e, no fim, "TODOS OS TESTES DA BUSCA PASSARAM".
-- =============================================================================
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@edkut.test', '{"name":"Ana Souza","username":"ana.souza"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'b@edkut.test', '{"name":"João da Silva","username":"joaosilva"}'),
  ('00000000-0000-0000-0000-0000000000c3', 'c@edkut.test', '{"name":"100% Real","username":"real_user"}'),
  ('00000000-0000-0000-0000-0000000000d4', 'd@edkut.test', '{"name":"Terceira Pessoa","username":"terceira"}');

create function pg_temp.val(p_role text, p_uid text, p_sql text) returns text
language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims',
    case when p_uid is null then '{}' else json_build_object('sub', p_uid, 'role', p_role)::text end, true);
  execute format('set local role %I', p_role);
  execute p_sql into v;
  execute 'reset role';
  return coalesce(v, 'nenhuma-linha');
exception when others then
  execute 'reset role';
  return 'erro=' || sqlstate;
end $$;

do $$
declare
  a text := '00000000-0000-0000-0000-0000000000a1';
  b text := '00000000-0000-0000-0000-0000000000b2';
  c text := '00000000-0000-0000-0000-0000000000c3';
  d text := '00000000-0000-0000-0000-0000000000d4';
  r text;
begin
  -- 1) autenticado lê as colunas usadas na busca
  r := pg_temp.val('authenticated', a,
    $q$select count(*) from (select id, username, name, user_type, headline, institution, avatar_emoji, avatar_color, avatar_path, created_at from public.profiles) t$q$);
  assert r = '4', 'autenticado deveria ler os 4 perfis, obteve ' || r;
  raise notice 'OK: usuário autenticado lê perfis (colunas da busca)';

  -- 2) anônimo não lê
  r := pg_temp.val('anon', null, 'select count(*) from public.profiles');
  assert r like 'erro=%' or r = '0', 'anon NÃO deveria ler profiles, obteve ' || r;
  raise notice 'OK: anon não lê profiles (%)', r;

  -- 3) por nome (todas as palavras, qualquer ordem, sem diferenciar maiúsculas)
  r := pg_temp.val('authenticated', a, $q$select string_agg(username, ',' order by username) from public.profiles where name ilike '%silva%' and name ilike '%joão%'$q$);
  assert r = 'joaosilva', 'busca por nome (2 palavras): ' || r;
  r := pg_temp.val('authenticated', a, $q$select string_agg(username, ',' order by username) from public.profiles where name ilike '%ANA%'$q$);
  assert r = 'ana.souza', 'busca por nome (maiúsculas): ' || r;
  raise notice 'OK: busca por nome';

  -- 4) por username e username exato
  r := pg_temp.val('authenticated', a, $q$select string_agg(username, ',' order by username) from public.profiles where username ilike '%silva%'$q$);
  assert r = 'joaosilva', 'busca por username: ' || r;
  r := pg_temp.val('authenticated', a, $q$select id::text from public.profiles where username = 'terceira'$q$);
  assert r = d, 'username exato: ' || r;
  raise notice 'OK: busca por username (parcial e exato)';

  -- 5) curingas escapados são texto literal (o app envia \% e \_)
  r := pg_temp.val('authenticated', a, $q$select string_agg(username, ',') from public.profiles where name ilike '%100\%%'$q$);
  assert r = 'real_user', '"100%" literal: ' || r;
  r := pg_temp.val('authenticated', a, $q$select string_agg(username, ',') from public.profiles where name ilike '%\%\%%'$q$);
  assert r = 'nenhuma-linha', '"%%" literal não pode listar todos: ' || r;
  r := pg_temp.val('authenticated', a, $q$select string_agg(username, ',') from public.profiles where username ilike '%real\_u%'$q$);
  assert r = 'real_user', '"real_u" literal: ' || r;
  r := pg_temp.val('authenticated', a, $q$select string_agg(username, ',') from public.profiles where username ilike '%\_\_%'$q$);
  assert r = 'nenhuma-linha', '"__" literal não pode listar todos: ' || r;
  raise notice 'OK: curingas LIKE tratados como texto';

  -- 6) limitação conhecida (informativa): sem extensão unaccent, "joao" NÃO encontra "João"
  r := pg_temp.val('authenticated', a, $q$select string_agg(username, ',') from public.profiles where name ilike '%joao%'$q$);
  raise notice 'INFO: busca "joao" (sem acento) => % (esperado: nenhuma-linha; busca por acento exige digitar o acento)', r;

  -- 7) profiles não tem e-mail nem senha
  r := pg_temp.val('authenticated', a, $q$select count(*) from information_schema.columns where table_schema='public' and table_name='profiles' and column_name in ('email','password','encrypted_password','phone')$q$);
  assert r = '0', 'profiles não pode ter colunas privadas: ' || r;
  raise notice 'OK: profiles sem e-mail/senha';

  -- 8) estado do botão: solicitação A→B pendente; só A e B enxergam; C/D não
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.friend_requests (receiver_id) values (b::uuid);
  execute 'reset role';
  r := pg_temp.val('authenticated', a, $q$select count(*) from public.friend_requests where status='pending' and (sender_id = auth.uid() or receiver_id = auth.uid())$q$);
  assert r = '1', 'A vê a solicitação enviada: ' || r;
  r := pg_temp.val('authenticated', b, $q$select count(*) from public.friend_requests where status='pending' and (sender_id = auth.uid() or receiver_id = auth.uid())$q$);
  assert r = '1', 'B vê a solicitação recebida: ' || r;
  r := pg_temp.val('authenticated', d, $q$select count(*) from public.friend_requests$q$);
  assert r = '0', 'terceiro NÃO vê solicitações alheias: ' || r;
  raise notice 'OK: solicitações pendentes só visíveis às duas partes';

  -- 9) amigos: friend_ids_of(A) lista B depois de aceitar
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.accept_friend_request((select id from public.friend_requests where sender_id = a::uuid limit 1));
  execute 'reset role';
  r := pg_temp.val('authenticated', a, format($q$select count(*) from public.friend_ids_of(%L::uuid) x where x::text = %L$q$, a, b));
  assert r = '1', 'friend_ids_of(A) deveria conter B: ' || r;
  raise notice 'OK: amizade aceita aparece em friend_ids_of';

  raise notice 'TODOS OS TESTES DA BUSCA PASSARAM';
end $$;

rollback;
