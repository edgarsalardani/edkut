-- =============================================================================
-- EdKut — Teste de fumaça de RESPOSTAS A SCRAPS (migração 11)
--
-- Rode DEPOIS de aplicar 20261115180001_scraps_replies.sql, SOMENTE em projeto de DESENVOLVIMENTO,
-- no SQL Editor, o arquivo inteiro. Cria 4 usuários de teste e termina em ROLLBACK (nada persiste).
-- Esperado: várias mensagens "OK: ..." e, no fim, "TODOS OS TESTES PASSARAM".
-- Papéis: E = dono do perfil, K = amigo de E, T = outro amigo de E (não é amigo de K), X = não amigo de ninguém.
-- =============================================================================
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'e@edkut.test', '{"name":"Edgar","username":"edgar"}'),
  ('00000000-0000-0000-0000-0000000000f2', 'k@edkut.test', '{"name":"Kaio Pesca","username":"kaio"}'),
  ('00000000-0000-0000-0000-0000000000a3', 't@edkut.test', '{"name":"Terceiro","username":"terceiro"}'),
  ('00000000-0000-0000-0000-0000000000b4', 'x@edkut.test', '{"name":"Outro","username":"outro"}');

create function pg_temp.run_as(p_role text, p_uid text, p_sql text) returns text
language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claims', case when p_uid is null then '{}' else json_build_object('sub', p_uid, 'role', p_role)::text end, true);
  execute format('set local role %I', p_role);
  execute p_sql;
  get diagnostics n = row_count;
  execute 'reset role';
  return 'rows=' || n;
exception when others then
  execute 'reset role';
  return 'erro=' || sqlstate;
end $$;

create function pg_temp.val(p_role text, p_uid text, p_sql text) returns text
language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims', case when p_uid is null then '{}' else json_build_object('sub', p_uid, 'role', p_role)::text end, true);
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
  e text := '00000000-0000-0000-0000-0000000000e1';
  k text := '00000000-0000-0000-0000-0000000000f2';
  t text := '00000000-0000-0000-0000-0000000000a3';
  x text := '00000000-0000-0000-0000-0000000000b4';
  req uuid; root uuid; reply1 uuid; reply2 uuid; other_root uuid; n bigint;
begin
  -- amizades pelo fluxo real: E-K e E-T (X não é amigo de ninguém)
  assert pg_temp.run_as('authenticated', k, format($q$insert into public.friend_requests (receiver_id) values (%L)$q$, e)) = 'rows=1', 'K solicita E';
  select id into req from public.friend_requests where sender_id = k::uuid and receiver_id = e::uuid;
  assert pg_temp.run_as('authenticated', e, format($q$select public.accept_friend_request(%L)$q$, req)) = 'rows=1', 'E aceita K';
  assert pg_temp.run_as('authenticated', t, format($q$insert into public.friend_requests (receiver_id) values (%L)$q$, e)) = 'rows=1', 'T solicita E';
  select id into req from public.friend_requests where sender_id = t::uuid and receiver_id = e::uuid;
  assert pg_temp.run_as('authenticated', e, format($q$select public.accept_friend_request(%L)$q$, req)) = 'rows=1', 'E aceita T';

  -- scrap raiz: regra da migração 10 preservada
  assert pg_temp.run_as('authenticated', x, format($q$insert into public.scraps (profile_owner_id, body) values (%L, 'de X')$q$, e)) = 'erro=42501', 'não-amigo não envia scrap raiz';
  assert pg_temp.run_as('authenticated', e, format($q$insert into public.scraps (profile_owner_id, body) values (%L, 'no proprio perfil')$q$, e)) = 'erro=42501', 'dono não cria scrap raiz no próprio perfil';
  assert pg_temp.run_as('authenticated', k, format($q$insert into public.scraps (profile_owner_id, body) values (%L, 'Fala, Edgar! :)')$q$, e)) = 'rows=1', 'K envia scrap raiz a E';
  select id into root from public.scraps where profile_owner_id = e::uuid and author_id = k::uuid;
  assert (select parent_id from public.scraps where id = root) is null, 'raiz tem parent_id nulo';
  raise notice 'OK: scrap raiz continua só entre amigos';

  -- notificação do scrap raiz (comportamento existente)
  select count(*) into n from public.notifications where user_id = e::uuid and kind = 'scrap';
  assert n = 1, 'raiz notifica o dono';

  -- RESPOSTAS (PD-30): dono e amigos do dono
  assert pg_temp.run_as('authenticated', e, format($q$insert into public.scraps (profile_owner_id, parent_id, body) values (%L, %L, 'Oi, Kaio! (L)')$q$, e, root)) = 'rows=1', 'DONO responde';
  assert pg_temp.run_as('authenticated', k, format($q$insert into public.scraps (profile_owner_id, parent_id, body) values (%L, %L, 'Tudo bem?')$q$, e, root)) = 'rows=1', 'autor do raiz (amigo) responde';
  assert pg_temp.run_as('authenticated', t, format($q$insert into public.scraps (profile_owner_id, parent_id, body) values (%L, %L, 'Entrei na conversa')$q$, e, root)) = 'rows=1', 'outro amigo do dono responde';
  select count(*) into n from public.scraps where parent_id = root;
  assert n = 3, 'três respostas vinculadas ao raiz';
  assert (select count(*) from public.scraps where parent_id = root and profile_owner_id = e::uuid) = 3, 'respostas no mesmo perfil';
  raise notice 'OK: dono e amigos do dono respondem; respostas ficam vinculadas ao raiz';

  -- notificações: resposta de amigo avisa o dono; resposta do dono não gera aviso
  select count(*) into n from public.notifications where user_id = e::uuid and kind = 'scrap';
  assert n = 3, 'respostas de K e T avisam o dono (kind scrap); a do dono não';
  assert (select count(*) from public.notifications where user_id = k::uuid and kind = 'scrap') = 0, 'dono respondendo não gera aviso (PD-35 padrão)';
  raise notice 'OK: notificações coerentes (sem novos tipos)';

  -- bloqueios
  assert pg_temp.run_as('authenticated', x, format($q$insert into public.scraps (profile_owner_id, parent_id, body) values (%L, %L, 'intruso')$q$, e, root)) = 'erro=42501', 'não-amigo NÃO responde (42501)';
  assert pg_temp.run_as('anon', null, format($q$insert into public.scraps (profile_owner_id, parent_id, body) values (%L, %L, 'anon')$q$, e, root)) like 'erro=%', 'anon não responde';
  assert pg_temp.run_as('authenticated', k, format($q$insert into public.scraps (profile_owner_id, parent_id, author_id, body) values (%L, %L, %L, 'forjado')$q$, e, root, t)) like 'erro=%', 'author_id não pode ser forjado';
  select id into reply1 from public.scraps where parent_id = root and author_id = e::uuid;
  assert pg_temp.run_as('authenticated', k, format($q$insert into public.scraps (profile_owner_id, parent_id, body) values (%L, %L, 'resposta de resposta')$q$, e, reply1)) = 'erro=23514', 'resposta a resposta é bloqueada (um nível)';
  assert pg_temp.run_as('authenticated', e, format($q$insert into public.scraps (profile_owner_id, parent_id, body) values (%L, %L, 'resposta de resposta')$q$, e, reply1)) = 'erro=23514', 'dono também não responde a resposta';
  assert pg_temp.run_as('authenticated', e, format($q$insert into public.scraps (profile_owner_id, parent_id, body) values (%L, %L, '')$q$, e, root)) = 'erro=23514', 'resposta vazia bloqueada';
  assert pg_temp.run_as('authenticated', e, format($q$insert into public.scraps (profile_owner_id, parent_id, body) values (%L, %L, %L)$q$, e, root, repeat('x', 1001))) = 'erro=23514', 'resposta > 1000 bloqueada';
  assert pg_temp.run_as('authenticated', e, format($q$insert into public.scraps (profile_owner_id, parent_id, body) values (%L, gen_random_uuid(), 'pai inexistente')$q$, e)) = 'erro=23503', 'pai inexistente bloqueado';
  raise notice 'OK: bloqueios (não amigo, anon, author_id forjado, resposta a resposta, tamanho, pai inexistente)';

  -- resposta no perfil errado: o pai está no perfil de E, a resposta declara o perfil de K
  assert pg_temp.run_as('authenticated', k, format($q$insert into public.scraps (profile_owner_id, parent_id, body) values (%L, %L, 'perfil trocado')$q$, k, root)) = 'erro=23503', 'resposta deve ficar no mesmo perfil do pai (FK composta)';
  raise notice 'OK: resposta não pode migrar para outro perfil';

  -- leitura: qualquer autenticado vê a conversa
  assert pg_temp.val('authenticated', x, format($q$select count(*) from public.scraps where parent_id = %L$q$, root)) = '3', 'terceiro lê as respostas (leitura inalterada)';

  -- respostas não são editáveis
  assert pg_temp.run_as('authenticated', e, format($q$update public.scraps set body = 'editado' where id = %L$q$, reply1)) like 'erro=%', 'resposta não é editável pelo cliente';
  assert pg_temp.run_as('authenticated', e, format($q$update public.scraps set parent_id = null where id = %L$q$, reply1)) like 'erro=%', 'parent_id não é alterável pelo cliente';

  -- amizade desfeita: K perde o direito de responder; o dono continua podendo
  delete from public.friendships where user_a in (e::uuid, k::uuid) and user_b in (e::uuid, k::uuid);
  assert pg_temp.run_as('authenticated', k, format($q$insert into public.scraps (profile_owner_id, parent_id, body) values (%L, %L, 'sem amizade')$q$, e, root)) = 'erro=42501', 'ex-amigo não responde mais';
  assert pg_temp.run_as('authenticated', e, format($q$insert into public.scraps (profile_owner_id, parent_id, body) values (%L, %L, 'dono segue respondendo')$q$, e, root)) = 'rows=1', 'dono continua respondendo';
  assert (select count(*) from public.scraps where parent_id = root) = 4, 'histórico das respostas de K permanece';
  raise notice 'OK: amizade desfeita bloqueia novas respostas e preserva o histórico';

  -- exclusão
  select id into reply2 from public.scraps where parent_id = root and author_id = t::uuid;
  assert pg_temp.run_as('authenticated', x, format($q$delete from public.scraps where id = %L$q$, reply2)) = 'rows=0', 'terceiro não apaga resposta';
  assert pg_temp.run_as('authenticated', t, format($q$delete from public.scraps where id = %L$q$, reply2)) = 'rows=1', 'autor apaga a própria resposta';
  select id into reply2 from public.scraps where parent_id = root and author_id = k::uuid;
  assert pg_temp.run_as('authenticated', e, format($q$delete from public.scraps where id = %L$q$, reply2)) = 'rows=1', 'dono do perfil apaga resposta alheia';
  assert pg_temp.run_as('authenticated', t, format($q$delete from public.scraps where id = %L$q$, root)) = 'rows=0', 'amigo não apaga o raiz alheio';
  assert pg_temp.run_as('authenticated', k, format($q$delete from public.scraps where id = %L$q$, root)) = 'rows=1', 'autor do raiz apaga o raiz';
  assert (select count(*) from public.scraps where parent_id = root) = 0, 'apagar o raiz apaga as respostas (cascata)';
  raise notice 'OK: exclusão (autor, dono) e cascata do raiz';

  -- o histórico anterior (scraps sem parent_id) segue legível
  assert (select count(*) from public.scraps where parent_id is null) = 0, 'nenhum raiz restante neste teste';

  raise notice 'TODOS OS TESTES PASSARAM';
end $$;

rollback;
