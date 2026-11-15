-- =============================================================================
-- EdKut — Teste de fumaça de COMUNIDADES (migrações 12 e 13)
--
-- Rode DEPOIS de aplicar 20261115200001_communities_join_policy_requests.sql e 20261115200002_communities_image.sql, SOMENTE em projeto de DESENVOLVIMENTO,
-- no SQL Editor, o arquivo inteiro. Cria 4 usuários de teste e termina em ROLLBACK (nada persiste).
-- Esperado: várias mensagens "OK: ..." e, no fim, "TODOS OS TESTES PASSARAM".
-- Papéis: E = criador, K = membro comum, T = outro usuário (vira membro/moderador), X = outro usuário, M = moderador promovido.
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
  cap uuid; cop uuid; rq uuid; rq2 uuid; r text;
begin
  -- ===================================================== CRIAÇÃO
  assert pg_temp.run_as('authenticated', e, $q$insert into public.communities (name, description, category, join_policy) values ('Aberta do E', 'desc', 'Geral', 'open')$q$) = 'rows=1', 'criar comunidade aberta';
  assert pg_temp.run_as('authenticated', e, $q$insert into public.communities (name, description, category, join_policy) values ('Fechada do E', 'desc', 'Geral', 'approval')$q$) = 'rows=1', 'criar comunidade com aprovação';
  assert pg_temp.run_as('authenticated', e, $q$insert into public.communities (name, description) values ('Sem tipo informado', 'desc')$q$) = 'rows=1', 'sem join_policy => padrão';
  select id into cop from public.communities where name = 'Aberta do E';
  select id into cap from public.communities where name = 'Fechada do E';
  assert (select join_policy from public.communities where name = 'Sem tipo informado') = 'open', 'padrão é aberta';
  assert (select creator_id from public.communities where id = cap) = e::uuid, 'creator_id = quem criou';
  assert (select role from public.community_members where community_id = cap and user_id = e::uuid) = 'moderator', 'criador entra como moderador';
  assert (select member_count from public.communities where id = cap) = 1, 'contador = 1';
  assert pg_temp.run_as('authenticated', e, $q$insert into public.communities (name, description, creator_id) values ('Forjada', 'desc', '00000000-0000-0000-0000-0000000000f2')$q$) like 'erro=%', 'cliente não informa creator_id';
  assert pg_temp.run_as('authenticated', e, $q$insert into public.communities (name, description, member_count) values ('Forjada2', 'desc', 999)$q$) like 'erro=%', 'cliente não informa member_count';
  assert pg_temp.run_as('authenticated', e, $q$insert into public.communities (name, description, join_policy) values ('Tipo invalido', 'desc', 'qualquer')$q$) like 'erro=%', 'join_policy inválido';
  raise notice 'OK: criação (tipo de entrada, criador moderador, campos protegidos)';

  -- ===================================================== COMUNIDADE ABERTA
  assert pg_temp.run_as('authenticated', t, format($q$insert into public.community_members (community_id) values (%L)$q$, cop)) = 'rows=1', 'T entra direto em comunidade aberta';
  assert (select member_count from public.communities where id = cop) = 2, 'contador sobe';
  assert pg_temp.run_as('authenticated', x, format($q$insert into public.community_members (community_id, role) values (%L, 'moderator')$q$, cop)) like 'erro=%', 'não entra como moderador';
  assert pg_temp.run_as('authenticated', x, format($q$insert into public.community_members (community_id, user_id) values (%L, %L)$q$, cop, k)) like 'erro=%', 'não coloca outra pessoa';
  assert pg_temp.run_as('authenticated', t, format($q$delete from public.community_members where community_id = %L and user_id = %L$q$, cop, t)) = 'rows=1', 'T sai';
  assert (select member_count from public.communities where id = cop) = 1, 'contador desce';
  raise notice 'OK: comunidade aberta (entrar e sair)';

  -- ===================================================== COMUNIDADE COM APROVAÇÃO
  assert pg_temp.run_as('authenticated', t, format($q$insert into public.community_members (community_id) values (%L)$q$, cap)) = 'erro=42501', 'entrada direta bloqueada em comunidade com aprovação';
  assert pg_temp.run_as('authenticated', t, format($q$select public.request_community_join(%L)$q$, cap)) = 'rows=1', 'T solicita';
  assert pg_temp.run_as('authenticated', t, format($q$select public.request_community_join(%L)$q$, cap)) = 'erro=23505', 'solicitação duplicada bloqueada';
  assert pg_temp.val('authenticated', t, format($q$select count(*) from public.community_members where community_id = %L and user_id = %L$q$, cap, t)) = '0', 'pendente não é membro';
  assert pg_temp.run_as('authenticated', t, format($q$insert into public.posts (community_id, kind, body) values (%L, 'texto', 'pendente postando')$q$, cap)) = 'erro=42501', 'pendente não publica na comunidade';
  assert pg_temp.val('authenticated', t, format($q$select public.is_community_member(%L)$q$, cap)) = 'false', 'is_community_member falso para pendente';
  raise notice 'OK: solicitação pendente não concede permissão; duplicidade bloqueada';

  -- visibilidade das solicitações
  assert pg_temp.val('authenticated', x, format($q$select count(*) from public.community_join_requests where community_id = %L$q$, cap)) = '0', 'terceiro não vê solicitações';
  assert pg_temp.val('authenticated', t, format($q$select count(*) from public.community_join_requests where community_id = %L$q$, cap)) = '1', 'solicitante vê a própria';
  assert pg_temp.val('authenticated', e, format($q$select count(*) from public.community_join_requests where community_id = %L$q$, cap)) = '1', 'criador vê as da comunidade';
  assert pg_temp.run_as('authenticated', t, format($q$insert into public.community_join_requests (community_id, user_id) values (%L, %L)$q$, cap, x)) like 'erro=%', 'sem INSERT direto em solicitações';
  assert pg_temp.run_as('authenticated', t, format($q$update public.community_join_requests set status = 'approved' where community_id = %L$q$, cap)) like 'erro=%', 'sem UPDATE direto em solicitações';
  assert pg_temp.run_as('anon', null, format($q$select public.request_community_join(%L)$q$, cap)) like 'erro=%', 'anon não solicita';
  select id into rq from public.community_join_requests where community_id = cap and user_id = t::uuid;
  assert pg_temp.run_as('authenticated', x, format($q$select public.decide_community_join_request(%L, true)$q$, rq)) = 'erro=42501', 'não-moderador não decide';
  assert pg_temp.run_as('authenticated', t, format($q$select public.decide_community_join_request(%L, true)$q$, rq)) = 'erro=42501', 'solicitante não aprova a si mesmo';
  raise notice 'OK: visibilidade e bloqueios das solicitações';

  -- cancelar e solicitar de novo
  assert pg_temp.val('authenticated', t, format($q$select public.cancel_community_join_request(%L)$q$, cap)) = 'true', 'T cancela';
  assert pg_temp.val('authenticated', t, format($q$select public.cancel_community_join_request(%L)$q$, cap)) = 'false', 'cancelar sem pendente => falso';
  assert pg_temp.val('authenticated', x, format($q$select public.cancel_community_join_request(%L)$q$, cap)) = 'false', 'terceiro não cancela a de outro';
  assert pg_temp.run_as('authenticated', t, format($q$select public.request_community_join(%L)$q$, cap)) = 'rows=1', 'pode solicitar de novo após cancelar';
  select id into rq from public.community_join_requests where community_id = cap and user_id = t::uuid and status = 'pending';
  raise notice 'OK: cancelamento e nova solicitação';

  -- aprovar
  assert pg_temp.val('authenticated', e, format($q$select public.decide_community_join_request(%L, true)$q$, rq)) = 'approved', 'criador aprova';
  assert pg_temp.val('authenticated', t, format($q$select role from public.community_members where community_id = %L and user_id = %L$q$, cap, t)) = 'member', 'T virou membro comum';
  assert (select member_count from public.communities where id = cap) = 2, 'contador após aprovação';
  assert pg_temp.run_as('authenticated', e, format($q$select public.decide_community_join_request(%L, true)$q$, rq)) = 'erro=55000', 'não decide duas vezes';
  assert pg_temp.run_as('authenticated', t, format($q$select public.request_community_join(%L)$q$, cap)) = 'erro=23505', 'membro não solicita';
  assert pg_temp.run_as('authenticated', t, format($q$insert into public.posts (community_id, kind, body) values (%L, 'texto', 'membro aprovado posta')$q$, cap)) = 'rows=1', 'membro aprovado publica';
  assert pg_temp.run_as('authenticated', x, format($q$insert into public.posts (community_id, kind, body) values (%L, 'texto', 'intruso')$q$, cap)) = 'erro=42501', 'não membro não publica (PD-34)';
  assert pg_temp.run_as('authenticated', x, $q$insert into public.posts (kind, body) values ('texto', 'post geral')$q$) = 'rows=1', 'publicação geral (sem comunidade) continua livre';
  raise notice 'OK: aprovação cria membro; publicação só de membros';

  -- recusar e tentar de novo
  assert pg_temp.run_as('authenticated', x, format($q$select public.request_community_join(%L)$q$, cap)) = 'rows=1', 'X solicita';
  select id into rq2 from public.community_join_requests where community_id = cap and user_id = x::uuid and status = 'pending';
  assert pg_temp.val('authenticated', e, format($q$select public.decide_community_join_request(%L, false)$q$, rq2)) = 'declined', 'criador recusa';
  assert pg_temp.val('authenticated', x, format($q$select count(*) from public.community_members where community_id = %L and user_id = %L$q$, cap, x)) = '0', 'recusado não é membro';
  assert pg_temp.run_as('authenticated', x, format($q$select public.request_community_join(%L)$q$, cap)) = 'rows=1', 'X pode solicitar de novo (padrão)';
  select id into rq2 from public.community_join_requests where community_id = cap and user_id = x::uuid and status = 'pending';
  raise notice 'OK: recusa e nova solicitação';

  -- ===================================================== MODERAÇÃO E ADMINISTRAÇÃO
  assert pg_temp.run_as('authenticated', t, format($q$update public.community_members set role = 'moderator' where community_id = %L and user_id = %L$q$, cap, t)) = 'rows=0', 'membro não se promove';
  assert pg_temp.run_as('authenticated', e, format($q$update public.community_members set role = 'moderator' where community_id = %L and user_id = %L$q$, cap, t)) = 'rows=1', 'criador promove T a moderador';
  assert pg_temp.val('authenticated', t, format($q$select public.decide_community_join_request(%L, true)$q$, rq2)) = 'approved', 'moderador aprova solicitação';
  assert pg_temp.val('authenticated', x, format($q$select role from public.community_members where community_id = %L and user_id = %L$q$, cap, x)) = 'member', 'X entrou como membro comum';
  -- moderador NÃO edita a comunidade (PD-41)
  assert pg_temp.run_as('authenticated', t, format($q$update public.communities set name = 'Renomeada pelo moderador' where id = %L$q$, cap)) = 'rows=0', 'moderador NÃO edita dados';
  assert pg_temp.run_as('authenticated', t, format($q$update public.communities set join_policy = 'open' where id = %L$q$, cap)) = 'rows=0', 'moderador NÃO muda tipo de entrada';
  assert pg_temp.run_as('authenticated', t, format($q$update public.community_members set role = 'moderator' where community_id = %L and user_id = %L$q$, cap, x)) = 'rows=0', 'moderador NÃO promove';
  -- moderador remove membro comum, mas não o criador nem outro moderador
  assert pg_temp.run_as('authenticated', t, format($q$delete from public.community_members where community_id = %L and user_id = %L$q$, cap, e)) = 'rows=0', 'moderador não remove o criador';
  assert pg_temp.run_as('authenticated', t, format($q$delete from public.community_members where community_id = %L and user_id = %L$q$, cap, x)) = 'rows=1', 'moderador remove membro comum';
  assert pg_temp.run_as('authenticated', x, format($q$insert into public.posts (community_id, kind, body) values (%L, 'texto', 'removido tentando')$q$, cap)) = 'erro=42501', 'removido perde a permissão de publicar';
  assert (select member_count from public.communities where id = cap) = 2, 'contador após remoção';
  -- criador edita
  assert pg_temp.run_as('authenticated', e, format($q$update public.communities set name = 'Fechada renomeada', description = 'nova', category = 'Pesquisa' where id = %L$q$, cap)) = 'rows=1', 'criador edita dados';
  assert pg_temp.run_as('authenticated', e, format($q$update public.communities set creator_id = %L where id = %L$q$, t, cap)) like 'erro=%', 'ninguém transfere o criador';
  assert pg_temp.run_as('authenticated', e, format($q$update public.communities set member_count = 50 where id = %L$q$, cap)) like 'erro=%', 'contador não é editável';
  assert pg_temp.run_as('authenticated', e, format($q$delete from public.community_members where community_id = %L and user_id = %L$q$, cap, e)) = 'rows=0', 'criador não sai da própria comunidade';
  assert pg_temp.run_as('authenticated', t, format($q$delete from public.community_members where community_id = %L and user_id = %L$q$, cap, t)) = 'rows=1', 'moderador pode sair';
  raise notice 'OK: moderação (aprovar/remover) e administração (só o criador edita e promove)';

  -- mudar o tipo com pendentes: continuam pendentes
  assert pg_temp.run_as('authenticated', t, format($q$select public.request_community_join(%L)$q$, cap)) = 'rows=1', 'T solicita de novo (ex-moderador, saiu)';
  assert pg_temp.run_as('authenticated', e, format($q$update public.communities set join_policy = 'open' where id = %L$q$, cap)) = 'rows=1', 'criador abre a comunidade';
  assert pg_temp.val('authenticated', e, format($q$select count(*) from public.community_join_requests where community_id = %L and status = 'pending'$q$, cap)) = '1', 'pendente continua pendente';
  assert pg_temp.run_as('authenticated', x, format($q$select public.request_community_join(%L)$q$, cap)) = 'erro=22023', 'solicitar em comunidade aberta é recusado';
  assert pg_temp.run_as('authenticated', x, format($q$insert into public.community_members (community_id) values (%L)$q$, cap)) = 'rows=1', 'agora X entra direto';
  assert pg_temp.run_as('authenticated', x, format($q$select public.request_community_join(%L)$q$, gen_random_uuid())) = 'erro=P0002', 'comunidade inexistente';
  raise notice 'OK: mudança de tipo de entrada preserva pendentes';

  -- ===================================================== IMAGEM (migração 13)
  assert pg_temp.run_as('authenticated', e, format($q$insert into storage.objects (bucket_id, name) values ('community-images', %L)$q$, cap || '/capa.png')) = 'rows=1', 'criador envia imagem';
  assert pg_temp.run_as('authenticated', t, format($q$insert into storage.objects (bucket_id, name) values ('community-images', %L)$q$, cap || '/outra.png')) like 'erro=%', 'não-criador não envia imagem';
  assert pg_temp.run_as('authenticated', e, format($q$insert into storage.objects (bucket_id, name) values ('community-images', %L)$q$, cap || '/arquivo.exe')) like 'erro=%', 'extensão inválida';
  assert pg_temp.run_as('authenticated', e, $q$insert into storage.objects (bucket_id, name) values ('community-images', 'pasta-qualquer/capa.png')$q$) like 'erro=%', 'pasta que não é de comunidade sua';
  assert pg_temp.run_as('authenticated', e, format($q$update public.communities set image_path = %L where id = %L$q$, cap || '/capa.png', cap)) = 'rows=1', 'criador grava image_path';
  assert pg_temp.run_as('authenticated', e, format($q$update public.communities set image_path = %L where id = %L$q$, cop || '/capa.png', cap)) = 'erro=23514', 'image_path de outra pasta é recusado';
  assert pg_temp.run_as('authenticated', t, format($q$update public.communities set image_path = null where id = %L$q$, cap)) = 'rows=0', 'não-criador não altera image_path';
  assert pg_temp.run_as('authenticated', e, format($q$delete from storage.objects where bucket_id = 'community-images' and name = %L$q$, cap || '/capa.png')) = 'rows=1', 'criador apaga a imagem';
  raise notice 'OK: imagem da comunidade (só o criador; caminho validado)';

  raise notice 'TODOS OS TESTES PASSARAM';
end $$;

rollback;
