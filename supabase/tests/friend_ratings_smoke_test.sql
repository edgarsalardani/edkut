-- =============================================================================
-- EdKut — Teste de fumaça da migração 9 (amizades reais + avaliações NERD/PARCEIRO/TECH)
--
-- Rode DEPOIS de aplicar 20261114160001_friend_ratings.sql, SOMENTE em projeto de DESENVOLVIMENTO,
-- no SQL Editor, o arquivo inteiro de uma vez. Cria 6 usuários de teste em auth.users e termina
-- em ROLLBACK (nada persiste). Se um ASSERT falhar, o script para com a mensagem; rode ROLLBACK;
-- Esperado: várias mensagens "OK: ..." e, no fim, "TODOS OS TESTES DE AVALIAÇÃO PASSARAM".
--
-- Cenários cobertos (lista do pedido): A e B amigos; A avalia B nos 3 indicadores; B vê os
-- percentuais; A altera o voto; média recalculada; terceiro amigo vota e a média usa os 2 votos;
-- não-amigo não vota; ninguém vota em si mesmo; amizade desfeita sai da média; ninguém altera
-- voto alheio; valores fora de 0–100; duplicidade; amizade refeita exige nova avaliação.
-- "Votos persistem após logout/login" é propriedade do banco (dados em tabela): confira no navegador.
-- =============================================================================
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@edkut.test', '{}'::jsonb),
  ('00000000-0000-0000-0000-0000000000b2', 'b@edkut.test', '{}'::jsonb),
  ('00000000-0000-0000-0000-0000000000c3', 'c@edkut.test', '{}'::jsonb),
  ('00000000-0000-0000-0000-0000000000d4', 'd@edkut.test', '{}'::jsonb),  -- nunca será amigo do B
  ('00000000-0000-0000-0000-0000000000e5', 'e@edkut.test', '{}'::jsonb),
  ('00000000-0000-0000-0000-0000000000f6', 'f@edkut.test', '{}'::jsonb);

-- Executa SQL "como" usuário logado (role authenticated + JWT sub = uid) ou anônimo (uid nulo).
-- Devolve 'rows=N' ou 'erro=<SQLSTATE>'.
create function pg_temp.run_as(p_role text, p_uid text, p_sql text) returns text
language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claims',
    case when p_uid is null then '{}' else json_build_object('sub', p_uid, 'role', p_role)::text end, true);
  execute format('set local role %I', p_role);
  execute p_sql;
  get diagnostics n = row_count;
  execute 'reset role';
  return 'rows=' || n;
exception when others then
  execute 'reset role';
  return 'erro=' || sqlstate;
end $$;

-- Igual, mas devolve a primeira linha de uma consulta (colunas separadas por '|') ou 'erro=<SQLSTATE>'.
create function pg_temp.val(p_role text, p_uid text, p_sql text) returns text
language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims',
    case when p_uid is null then '{}' else json_build_object('sub', p_uid, 'role', p_role)::text end, true);
  execute format('set local role %I', p_role);
  execute 'select replace(translate(t::text, ''()'', ''''), '','', ''|'') from (' || p_sql || ') t' into v;
  execute 'reset role';
  return coalesce(v, 'nenhuma-linha');
exception when others then
  execute 'reset role';
  return 'erro=' || sqlstate;
end $$;

do $$
declare
  A constant text := '00000000-0000-0000-0000-0000000000a1';
  B constant text := '00000000-0000-0000-0000-0000000000b2';
  C constant text := '00000000-0000-0000-0000-0000000000c3';
  D constant text := '00000000-0000-0000-0000-0000000000d4';
  E constant text := '00000000-0000-0000-0000-0000000000e5';
  F constant text := '00000000-0000-0000-0000-0000000000f6';
  req uuid;
begin
  -- ===== amizades reais: solicitação -> aceite (RPC) -> linha em friendships ======
  assert pg_temp.run_as('authenticated', A, format($q$insert into public.friend_requests (receiver_id) values (%L)$q$, B)) = 'rows=1', 'A deveria enviar solicitação ao B';
  select id into req from public.friend_requests where sender_id = A::uuid and receiver_id = B::uuid and status = 'pending';
  assert pg_temp.run_as('authenticated', A, format($q$select public.accept_friend_request(%L)$q$, req)) = 'erro=P0002', 'o REMETENTE não pode aceitar a própria solicitação';
  assert not public.are_friends(A::uuid, B::uuid), 'ainda não são amigos';
  assert pg_temp.run_as('authenticated', B, format($q$select public.accept_friend_request(%L)$q$, req)) = 'rows=1', 'B deveria aceitar';
  assert public.are_friends(A::uuid, B::uuid), 'A e B deveriam ser amigos';
  -- C e F também viram amigos do B
  insert into public.friend_requests (sender_id, receiver_id) values (C::uuid, B::uuid), (F::uuid, B::uuid);
  perform set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.accept_friend_request(id) from public.friend_requests where receiver_id = B::uuid and status = 'pending';
  reset role;
  assert public.are_friends(C::uuid, B::uuid) and public.are_friends(F::uuid, B::uuid), 'C e F deveriam ser amigos do B';
  assert not public.are_friends(D::uuid, B::uuid), 'D não é amigo do B';
  raise notice 'OK: solicitação -> aceite -> amizade (só o destinatário aceita)';

  -- ===== sem votos: 0%, 0%, 0% e contagem 0 =====================================
  assert pg_temp.val('authenticated', B, format($q$select * from public.profile_social_scores(%L)$q$, B)) = '0|0|0|0', 'sem votos => 0|0|0|0';
  raise notice 'OK: sem avaliações => 0 por cento e contagem 0';

  -- ===== A avalia B; B vê os percentuais ========================================
  assert pg_temp.run_as('authenticated', A, format($q$select public.rate_friend(%L, 80, 70, 60)$q$, B)) = 'rows=1', 'A deveria avaliar o B';
  assert pg_temp.val('authenticated', B, format($q$select * from public.profile_social_scores(%L)$q$, B)) = '80|70|60|1', 'B deveria ver 80|70|60 com 1 avaliador';
  assert pg_temp.val('authenticated', D, format($q$select * from public.profile_social_scores(%L)$q$, B)) = '80|70|60|1', 'qualquer usuário logado vê o consolidado (visibilidade já existente)';
  raise notice 'OK: A avalia B (3 indicadores); B e visitantes veem os percentuais consolidados';

  -- ===== A altera o voto: substitui, sem duplicar =================================
  assert pg_temp.run_as('authenticated', A, format($q$select public.rate_friend(%L, 100, 50, 40)$q$, B)) = 'rows=1', 'A deveria poder alterar';
  assert (select count(*) from public.friend_ratings where rater_id = A::uuid and rated_id = B::uuid) = 1, 'não pode haver voto duplicado';
  assert pg_temp.val('authenticated', B, format($q$select * from public.profile_social_scores(%L)$q$, B)) = '100|50|40|1', 'média deveria refletir só o voto novo';
  raise notice 'OK: alterar o voto substitui o anterior (1 linha por par)';

  -- ===== segundo e terceiro amigos: média aritmética, peso igual ==================
  perform pg_temp.run_as('authenticated', C, format($q$select public.rate_friend(%L, 0, 90, 90)$q$, B));
  assert pg_temp.val('authenticated', B, format($q$select * from public.profile_social_scores(%L)$q$, B)) = '50|70|65|2', 'média de A(100,50,40) e C(0,90,90) => 50|70|65';
  -- exemplo do enunciado: TECH 80, 90, 100 => 90
  perform pg_temp.run_as('authenticated', A, format($q$select public.rate_friend(%L, 10, 10, 80)$q$, B));
  perform pg_temp.run_as('authenticated', C, format($q$select public.rate_friend(%L, 10, 10, 90)$q$, B));
  perform pg_temp.run_as('authenticated', F, format($q$select public.rate_friend(%L, 10, 10, 100)$q$, B));
  assert pg_temp.val('authenticated', B, format($q$select * from public.profile_social_scores(%L)$q$, B)) = '10|10|90|3', 'TECH 80, 90, 100 => 90 (3 avaliadores)';
  -- arredondamento: média 84,5 => 85
  perform pg_temp.run_as('authenticated', A, format($q$select public.rate_friend(%L, 84, 0, 0)$q$, B));
  perform pg_temp.run_as('authenticated', C, format($q$select public.rate_friend(%L, 85, 0, 0)$q$, B));
  perform pg_temp.run_as('authenticated', F, format($q$select public.rate_friend(%L, 85, 0, 0)$q$, B));
  assert (select nerd from public.profile_social_scores(B::uuid)) = 85, 'média 84,67 => 85';
  raise notice 'OK: média aritmética com peso igual (TECH 80/90/100 => 90), arredondada ao inteiro';

  -- ===== quem NÃO pode votar =====================================================
  assert pg_temp.run_as('authenticated', D, format($q$select public.rate_friend(%L, 50, 50, 50)$q$, B)) = 'erro=42501', 'não-amigo não pode votar (RPC)';
  assert pg_temp.run_as('authenticated', D, format($q$insert into public.friend_ratings (rated_id, nerd, parceiro, tech) values (%L, 50, 50, 50)$q$, B)) = 'erro=42501', 'não-amigo não pode votar (INSERT direto -> RLS)';
  assert pg_temp.run_as('authenticated', B, format($q$select public.rate_friend(%L, 100, 100, 100)$q$, B)) = 'erro=22023', 'ninguém vota em si mesmo (RPC)';
  assert pg_temp.run_as('authenticated', B, format($q$insert into public.friend_ratings (rated_id, nerd, parceiro, tech) values (%L, 100, 100, 100)$q$, B)) in ('erro=42501','erro=23514'), 'ninguém vota em si mesmo (INSERT direto)';
  assert pg_temp.run_as('anon', null, format($q$select public.rate_friend(%L, 50, 50, 50)$q$, B)) = 'erro=42501', 'anon não executa rate_friend';
  assert pg_temp.run_as('anon', null, format($q$select * from public.profile_social_scores(%L)$q$, B)) = 'erro=42501', 'anon não lê o consolidado';
  assert pg_temp.run_as('anon', null, $q$select * from public.friend_ratings$q$) = 'erro=42501', 'anon não lê a tabela';
  raise notice 'OK: não-amigo, o próprio usuário e anônimo não conseguem votar';

  -- ===== valores fora de 0–100 e duplicidade ======================================
  assert pg_temp.run_as('authenticated', A, format($q$select public.rate_friend(%L, 101, 50, 50)$q$, B)) = 'erro=22003', 'valor > 100 (RPC)';
  assert pg_temp.run_as('authenticated', A, format($q$select public.rate_friend(%L, 50, -1, 50)$q$, B)) = 'erro=22003', 'valor < 0 (RPC)';
  assert pg_temp.run_as('authenticated', A, format($q$update public.friend_ratings set tech = 101 where rated_id = %L$q$, B)) = 'erro=23514', 'valor > 100 (UPDATE direto -> CHECK)';
  assert pg_temp.run_as('authenticated', A, format($q$update public.friend_ratings set tech = -5 where rated_id = %L$q$, B)) = 'erro=23514', 'valor < 0 (UPDATE direto -> CHECK)';
  assert pg_temp.run_as('authenticated', A, format($q$insert into public.friend_ratings (rated_id, nerd, parceiro, tech) values (%L, 1, 1, 1)$q$, B)) = 'erro=23505', 'INSERT duplicado do par deve violar a PK';
  assert pg_temp.run_as('authenticated', A, format($q$select public.rate_friend(%L, 0, 0, 100)$q$, B)) = 'rows=1', 'limites 0 e 100 são válidos';
  raise notice 'OK: faixa 0–100 e unicidade por par garantidas no banco';

  -- ===== ninguém altera voto alheio nem o consolidado ==============================
  assert pg_temp.run_as('authenticated', A, format($q$update public.friend_ratings set tech = 0 where rater_id = %L$q$, C)) = 'rows=0', 'A não altera o voto do C';
  assert pg_temp.run_as('authenticated', B, format($q$update public.friend_ratings set tech = 0 where rated_id = %L$q$, B)) = 'rows=0', 'o avaliado não altera os votos que recebeu';
  assert pg_temp.run_as('authenticated', B, $q$select * from public.friend_ratings$q$) = 'rows=0', 'o avaliado não enxerga votos individuais';
  assert pg_temp.run_as('authenticated', A, format($q$insert into public.friend_ratings (rater_id, rated_id, nerd, parceiro, tech) values (%L, %L, 1, 1, 1)$q$, C, B)) = 'erro=42501', 'não dá para informar rater_id (falsificar autoria)';
  assert pg_temp.run_as('authenticated', A, format($q$update public.friend_ratings set rater_id = %L where rater_id = %L$q$, C, A)) = 'erro=42501', 'rater_id não é atualizável';
  assert pg_temp.run_as('authenticated', A, format($q$update public.friend_ratings set updated_at = now() where rated_id = %L$q$, B)) = 'erro=42501', 'updated_at não é editável';
  assert pg_temp.run_as('authenticated', A, format($q$delete from public.friend_ratings where rater_id = %L$q$, C)) = 'erro=42501', 'sem DELETE para o cliente';
  assert pg_temp.run_as('authenticated', B, format($q$update public.profile_scores set tech_base = 100 where profile_id = %L$q$, B)) = 'erro=42501', 'indicadores legados também não são editáveis';
  assert pg_temp.val('authenticated', A, format($q$select nerd, parceiro, tech from public.my_friend_rating(%L)$q$, B)) = '0|0|100', 'A vê apenas o PRÓPRIO voto';
  assert pg_temp.val('authenticated', C, format($q$select nerd, parceiro, tech from public.my_friend_rating(%L)$q$, B)) = '85|0|0', 'C vê apenas o próprio voto (não o do A)';
  raise notice 'OK: ninguém altera/lê votos alheios; sem DELETE; sem falsificar autoria; consolidado não é editável';

  -- ===== amizade desfeita: o voto deixa de contar ==================================
  -- estado: A(0,0,100) C(85,0,0) F(85,0,0)
  assert (select ratings_count from public.profile_social_scores(B::uuid)) = 3, 'antes: 3 votos válidos';
  assert pg_temp.run_as('authenticated', A, format($q$delete from public.friendships where user_a = least(%L::uuid, %L::uuid) and user_b = greatest(%L::uuid, %L::uuid)$q$, A, B, A, B)) = 'rows=1', 'A deveria poder desfazer a amizade';
  assert pg_temp.val('authenticated', B, format($q$select * from public.profile_social_scores(%L)$q$, B)) = '85|0|0|2', 'sem o voto do A: média de C e F';
  assert (select count(*) from public.friend_ratings where rater_id = A::uuid) = 1, 'o voto do A continua guardado (não foi apagado), só não conta';
  assert pg_temp.run_as('authenticated', A, format($q$select public.rate_friend(%L, 1, 1, 1)$q$, B)) = 'erro=42501', 'ex-amigo não pode votar de novo';
  assert pg_temp.run_as('authenticated', A, format($q$update public.friend_ratings set nerd = 1 where rated_id = %L$q$, B)) = 'rows=0', 'ex-amigo não consegue editar o voto antigo (RLS)';
  assert pg_temp.val('authenticated', A, format($q$select is_current from public.my_friend_rating(%L)$q$, B)) = 'f', 'my_friend_rating: voto antigo não está sendo contado';
  raise notice 'OK: amizade desfeita => voto fora da média (e não pode ser editado nem refeito)';

  -- ===== amizade refeita: votos antigos NÃO voltam; é preciso nova avaliação ======
  perform pg_temp.run_as('authenticated', A, format($q$insert into public.friend_requests (receiver_id) values (%L)$q$, B));
  select id into req from public.friend_requests where sender_id = A::uuid and receiver_id = B::uuid and status = 'pending';
  perform pg_temp.run_as('authenticated', B, format($q$select public.accept_friend_request(%L)$q$, req));
  assert public.are_friends(A::uuid, B::uuid), 'amizade refeita';
  -- (numa execução real o novo created_at é POSTERIOR ao voto; aqui tudo cabe na mesma transação, então simulamos o tempo)
  update public.friendships set created_at = now() + interval '1 hour'
   where user_a = least(A::uuid, B::uuid) and user_b = greatest(A::uuid, B::uuid);
  assert (select ratings_count from public.profile_social_scores(B::uuid)) = 2, 'amizade refeita: o voto antigo do A NÃO volta a contar';
  assert pg_temp.val('authenticated', A, format($q$select is_current from public.my_friend_rating(%L)$q$, B)) = 'f', 'voto antigo segue marcado como não-atual';
  -- o avaliador confirma/atualiza explicitamente => passa a contar com o valor novo
  update public.friendships set created_at = now() - interval '1 hour'
   where user_a = least(A::uuid, B::uuid) and user_b = greatest(A::uuid, B::uuid);
  assert pg_temp.run_as('authenticated', A, format($q$select public.rate_friend(%L, 60, 60, 60)$q$, B)) = 'rows=1', 'A deveria poder votar de novo';
  assert pg_temp.val('authenticated', A, format($q$select is_current from public.my_friend_rating(%L)$q$, B)) = 't', 'novo voto é atual';
  assert (select ratings_count from public.profile_social_scores(B::uuid)) = 3, 'com a nova avaliação, o A volta a contar';
  raise notice 'OK: amizade refeita exige nova avaliação (política documentada)';

  -- ===== exclusão de conta: votos do avaliador somem em cascata ====================
  delete from auth.users where id = C::uuid;
  assert (select ratings_count from public.profile_social_scores(B::uuid)) = 2, 'conta do C apagada => voto some (CASCADE)';
  raise notice 'OK: exclusão de conta remove os votos do avaliador';

  raise notice 'TODOS OS TESTES DE AVALIAÇÃO PASSARAM';
end $$;

rollback;
