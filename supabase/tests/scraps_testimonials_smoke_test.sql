-- =============================================================================
-- EdKut — Teste de fumaça de SCRAPS (migração 10) e DEPOIMENTOS (políticas da migração 6)
--
-- Rode DEPOIS de aplicar 20261115120001_scraps_friends_only.sql, SOMENTE em projeto de DESENVOLVIMENTO,
-- no SQL Editor, o arquivo inteiro. Cria 4 usuários de teste e termina em ROLLBACK (nada persiste).
-- Esperado: várias mensagens "OK: ..." e, no fim, "TODOS OS TESTES PASSARAM".
-- Papéis: E = Edgar, K = Kaio (amigos), T = terceiro (não é amigo de ninguém), X = outro terceiro.
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
  r text; sid uuid; tid uuid; req uuid;
begin
  -- ---------------------------------------------------------------- amizade E <-> K (pelo fluxo real)
  assert pg_temp.run_as('authenticated', e, format($q$insert into public.friend_requests (receiver_id) values (%L)$q$, k)) = 'rows=1', 'E envia solicitação';
  select id into req from public.friend_requests where sender_id = e::uuid and receiver_id = k::uuid;
  assert pg_temp.run_as('authenticated', k, format($q$select public.accept_friend_request(%L)$q$, req)) = 'rows=1', 'K aceita';

  -- ================================================================ SCRAPS
  assert pg_temp.run_as('authenticated', t, format($q$insert into public.scraps (profile_owner_id, body) values (%L, 'oi do terceiro')$q$, e)) = 'erro=42501',
    'NÃO-amigo não pode enviar scrap (esperado 42501)';
  raise notice 'OK: não-amigo é bloqueado ao enviar scrap';

  assert pg_temp.run_as('authenticated', e, format($q$insert into public.scraps (profile_owner_id, body) values (%L, 'scrap no próprio perfil')$q$, e)) = 'erro=42501',
    'scrap no PRÓPRIO perfil é bloqueado';
  raise notice 'OK: scrap em si mesmo é bloqueado';

  assert pg_temp.run_as('authenticated', e, format($q$insert into public.scraps (profile_owner_id, body) values (%L, 'Fala, Kaio!')$q$, k)) = 'rows=1',
    'amigo E -> K deve funcionar';
  assert pg_temp.run_as('authenticated', k, format($q$insert into public.scraps (profile_owner_id, body) values (%L, 'Fala, Edgar!')$q$, e)) = 'rows=1',
    'amigo K -> E deve funcionar (vale nos dois sentidos)';
  raise notice 'OK: amigos enviam scraps nos dois sentidos';

  assert pg_temp.run_as('authenticated', e, format($q$insert into public.scraps (profile_owner_id, author_id, body) values (%L, %L, 'falsificado')$q$, k, t)) like 'erro=%',
    'cliente NÃO pode informar author_id';
  raise notice 'OK: author_id não pode ser forjado';

  assert pg_temp.run_as('authenticated', e, format($q$insert into public.scraps (profile_owner_id, body) values (%L, '')$q$, k)) = 'erro=23514', 'scrap vazio bloqueado';
  assert pg_temp.run_as('authenticated', e, format($q$insert into public.scraps (profile_owner_id, body) values (%L, %L)$q$, k, repeat('x', 1001))) = 'erro=23514', 'scrap > 1000 bloqueado';
  assert pg_temp.run_as('anon', null, format($q$insert into public.scraps (profile_owner_id, body) values (%L, 'anon')$q$, k)) like 'erro=%', 'anon não envia';
  raise notice 'OK: validações de tamanho e anon';

  -- persistência / visibilidade
  assert pg_temp.val('authenticated', t, format($q$select count(*) from public.scraps where profile_owner_id = %L$q$, k)) = '1', 'terceiro lê os scraps públicos do perfil de K';
  assert pg_temp.val('authenticated', k, format($q$select body from public.scraps where profile_owner_id = %L$q$, k)) = 'Fala, Kaio!', 'K lê o scrap recebido';
  raise notice 'OK: scraps recebidos ficam visíveis no perfil do destinatário';

  -- apagar: terceiro não; autor e dono sim
  select id into sid from public.scraps where profile_owner_id = k::uuid;
  assert pg_temp.run_as('authenticated', t, format($q$delete from public.scraps where id = %L$q$, sid)) = 'rows=0', 'terceiro NÃO apaga scrap alheio';
  assert pg_temp.run_as('authenticated', k, format($q$delete from public.scraps where id = %L$q$, sid)) = 'rows=1', 'DONO do perfil apaga scrap recebido';
  assert pg_temp.run_as('authenticated', e, format($q$insert into public.scraps (profile_owner_id, body) values (%L, 'de novo')$q$, k)) = 'rows=1', 'reenvio';
  select id into sid from public.scraps where profile_owner_id = k::uuid;
  assert pg_temp.run_as('authenticated', e, format($q$delete from public.scraps where id = %L$q$, sid)) = 'rows=1', 'AUTOR apaga o próprio scrap';
  raise notice 'OK: exclusão só por dono do perfil ou autor';

  -- scraps não podem ser editados
  assert pg_temp.run_as('authenticated', k, format($q$update public.scraps set body = 'editado' where profile_owner_id = %L$q$, e)) like 'erro=%', 'scrap não é editável pelo cliente';

  -- amizade desfeita: histórico fica, novo envio bloqueado
  assert pg_temp.run_as('authenticated', e, format($q$delete from public.friendships where user_a = least(%L::uuid, %L::uuid) and user_b = greatest(%L::uuid, %L::uuid)$q$, e, k, e, k)) = 'rows=1', 'E desfaz a amizade';
  assert pg_temp.val('authenticated', t, format($q$select count(*) from public.scraps where profile_owner_id = %L$q$, e)) = '1', 'scrap antigo permanece depois de desfazer a amizade';
  assert pg_temp.run_as('authenticated', k, format($q$insert into public.scraps (profile_owner_id, body) values (%L, 'depois do fim')$q$, e)) = 'erro=42501', 'ex-amigo bloqueado';
  raise notice 'OK: após desfazer a amizade o histórico permanece e novos scraps são bloqueados';

  -- refaz a amizade para os testes de depoimento (não é necessária, mas deixa o cenário normal)
  assert pg_temp.run_as('authenticated', e, format($q$insert into public.friend_requests (receiver_id) values (%L)$q$, k)) = 'rows=1', 're-solicitação';
  select id into req from public.friend_requests where sender_id = e::uuid and receiver_id = k::uuid and status = 'pending';
  assert pg_temp.run_as('authenticated', k, format($q$select public.accept_friend_request(%L)$q$, req)) = 'rows=1', 're-aceite';

  -- ================================================================ DEPOIMENTOS
  assert pg_temp.run_as('authenticated', e, format($q$insert into public.testimonials (profile_owner_id, body) values (%L, 'Kaio é muito parceiro!')$q$, k)) = 'rows=1', 'E envia depoimento a K';
  select id into tid from public.testimonials where profile_owner_id = k::uuid;
  assert pg_temp.val('authenticated', e, format($q$select status::text from public.testimonials where id = %L$q$, tid)) = 'pending', 'nasce pending';
  assert pg_temp.run_as('authenticated', e, format($q$insert into public.testimonials (profile_owner_id, body, status) values (%L, 'x', 'approved')$q$, x)) like 'erro=%', 'cliente não insere com status approved';
  assert pg_temp.run_as('authenticated', e, format($q$insert into public.testimonials (profile_owner_id, body) values (%L, 'segundo pendente')$q$, k)) = 'erro=23505', 'só 1 pendente por par';
  assert pg_temp.run_as('authenticated', e, format($q$insert into public.testimonials (profile_owner_id, body) values (%L, 'sobre mim')$q$, e)) = 'erro=23514', 'depoimento sobre si mesmo é bloqueado';
  raise notice 'OK: depoimento nasce pending; 1 pendente por par; sem autodepoimento';

  assert pg_temp.val('authenticated', k, format($q$select count(*) from public.testimonials where profile_owner_id = %L and status = 'pending'$q$, k)) = '1', 'destinatário vê o pendente';
  assert pg_temp.val('authenticated', e, format($q$select count(*) from public.testimonials where id = %L$q$, tid)) = '1', 'AUTOR acompanha o próprio depoimento';
  assert pg_temp.val('authenticated', t, format($q$select count(*) from public.testimonials where id = %L$q$, tid)) = '0', 'terceiro NÃO vê depoimento pendente';
  raise notice 'OK: visibilidade do pendente (destinatário e autor sim; terceiro não)';

  assert pg_temp.run_as('authenticated', e, format($q$update public.testimonials set status = 'approved' where id = %L$q$, tid)) = 'rows=0', 'AUTOR não aprova o próprio depoimento';
  assert pg_temp.run_as('authenticated', t, format($q$update public.testimonials set status = 'approved' where id = %L$q$, tid)) = 'rows=0', 'terceiro não aprova';
  assert pg_temp.run_as('authenticated', k, format($q$update public.testimonials set body = 'adulterado' where id = %L$q$, tid)) like 'erro=%', 'ninguém edita o texto';
  assert pg_temp.run_as('authenticated', k, format($q$update public.testimonials set status = 'pending' where id = %L$q$, tid)) like 'erro=%' or
         pg_temp.val('authenticated', k, format($q$select status::text from public.testimonials where id = %L$q$, tid)) = 'pending', 'status só vai para approved/rejected';
  raise notice 'OK: somente o destinatário decide (e só entre aprovar/rejeitar)';

  assert pg_temp.run_as('authenticated', k, format($q$update public.testimonials set status = 'approved' where id = %L$q$, tid)) = 'rows=1', 'K aprova';
  assert pg_temp.val('authenticated', t, format($q$select count(*) from public.testimonials where id = %L$q$, tid)) = '1', 'aprovado fica PÚBLICO (terceiro vê)';
  assert pg_temp.val('authenticated', k, format($q$select (reviewed_at is not null)::text from public.testimonials where id = %L$q$, tid)) = 'true', 'reviewed_at preenchido';
  raise notice 'OK: aprovado aparece publicamente';

  assert pg_temp.run_as('authenticated', k, format($q$update public.testimonials set status = 'rejected' where id = %L$q$, tid)) = 'rows=1', 'K pode mudar de ideia (rejeitar)';
  assert pg_temp.val('authenticated', t, format($q$select count(*) from public.testimonials where id = %L$q$, tid)) = '0', 'rejeitado some do público';
  assert pg_temp.val('authenticated', e, format($q$select status::text from public.testimonials where id = %L$q$, tid)) = 'rejected', 'autor vê "rejected" no próprio depoimento';
  raise notice 'OK: rejeitado não é público; autor vê o status';

  -- depois de decidido, o autor pode enviar um novo
  assert pg_temp.run_as('authenticated', e, format($q$insert into public.testimonials (profile_owner_id, body) values (%L, 'novo depoimento')$q$, k)) = 'rows=1', 'novo depoimento após decisão';
  assert pg_temp.run_as('authenticated', t, format($q$delete from public.testimonials where profile_owner_id = %L$q$, k)) = 'rows=0', 'terceiro não apaga';
  assert pg_temp.run_as('authenticated', k, format($q$delete from public.testimonials where profile_owner_id = %L and status = 'rejected'$q$, k)) = 'rows=1', 'destinatário apaga';
  assert pg_temp.run_as('authenticated', e, format($q$delete from public.testimonials where profile_owner_id = %L$q$, k)) = 'rows=1', 'autor apaga o próprio';
  raise notice 'OK: exclusão de depoimentos (autor ou destinatário)';

  raise notice 'TODOS OS TESTES PASSARAM';
end $$;

rollback;
