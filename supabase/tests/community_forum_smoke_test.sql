-- =============================================================================
-- EdKut — Teste de fumaça do FÓRUM DAS COMUNIDADES (migração 15)
--
-- Rode DEPOIS de aplicar 20261117150001_community_forum.sql, SOMENTE em projeto de DESENVOLVIMENTO, no SQL Editor,
-- o arquivo inteiro. Cria usuários de teste e termina em ROLLBACK (nada persiste).
-- Esperado: várias mensagens "OK: ..." e, no fim, "TODOS OS TESTES DO FÓRUM PASSARAM".
-- Papéis: E = criador (moderador), M = moderador promovido, K = membro, T = NÃO membro, X = pediu entrada
-- (comunidade com aprovação, ainda pendente), Y = membro usado só nos testes de limite de frequência.
-- =============================================================================
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'e@edkut.test', '{"name":"Edgar","username":"edgar"}'),
  ('00000000-0000-0000-0000-0000000000f2', 'k@edkut.test', '{"name":"Kaio","username":"kaio"}'),
  ('00000000-0000-0000-0000-0000000000a3', 't@edkut.test', '{"name":"Terceiro","username":"terceiro"}'),
  ('00000000-0000-0000-0000-0000000000b4', 'x@edkut.test', '{"name":"Outro","username":"outro"}'),
  ('00000000-0000-0000-0000-0000000000c5', 'm@edkut.test', '{"name":"Moderadora","username":"moderadora"}'),
  ('00000000-0000-0000-0000-0000000000d6', 'y@edkut.test', '{"name":"Flood","username":"flood"}');

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
  m text := '00000000-0000-0000-0000-0000000000c5';
  y text := '00000000-0000-0000-0000-0000000000d6';
  co uuid; cap uuid; co2 uuid;
  tp uuid; tp2 uuid; tpm uuid; c1 uuid; c2 uuid; r1 uuid; r2 uuid; cm uuid;
  r text; i int; before_ts timestamptz;
begin
  -- ===================================================== PREPARO
  assert pg_temp.run_as('authenticated', e, $q$insert into public.communities (name, description, join_policy) values ('Aberta do fórum', 'd', 'open')$q$) = 'rows=1';
  assert pg_temp.run_as('authenticated', e, $q$insert into public.communities (name, description, join_policy) values ('Fechada do fórum', 'd', 'approval')$q$) = 'rows=1';
  assert pg_temp.run_as('authenticated', e, $q$insert into public.communities (name, description, join_policy) values ('Outra aberta', 'd', 'open')$q$) = 'rows=1';
  select id into co from public.communities where name = 'Aberta do fórum';
  select id into cap from public.communities where name = 'Fechada do fórum';
  select id into co2 from public.communities where name = 'Outra aberta';
  assert pg_temp.run_as('authenticated', k, format($q$insert into public.community_members (community_id) values (%L)$q$, co)) = 'rows=1', 'K entra';
  assert pg_temp.run_as('authenticated', m, format($q$insert into public.community_members (community_id) values (%L)$q$, co)) = 'rows=1', 'M entra';
  assert pg_temp.run_as('authenticated', y, format($q$insert into public.community_members (community_id) values (%L)$q$, co)) = 'rows=1', 'Y entra';
  assert pg_temp.run_as('authenticated', e, format($q$update public.community_members set role = 'moderator' where community_id = %L and user_id = %L$q$, co, m)) = 'rows=1', 'E promove M';
  assert pg_temp.run_as('authenticated', x, format($q$select public.request_community_join(%L)$q$, cap)) = 'rows=1', 'X solicita entrada (pendente)';
  raise notice 'OK: preparo (comunidades, papéis, solicitação pendente)';

  -- ===================================================== 1 e 2: CRIAR TÓPICO
  assert pg_temp.run_as('authenticated', k, format($q$insert into public.community_topics (community_id, title, body) values (%L, '  Primeiro   tópico  ', E'  Olá, pessoal! :)\n  ')$q$, co)) = 'rows=1', '1: membro cria tópico';
  select id into tp from public.community_topics where community_id = co;
  assert (select author_id from public.community_topics where id = tp) = k::uuid, 'autor = quem criou (auth.uid)';
  assert (select title from public.community_topics where id = tp) = 'Primeiro tópico', 'título normalizado (espaços)';
  assert (select body from public.community_topics where id = tp) = 'Olá, pessoal! :)', 'mensagem aparada, emoticon preservado como texto';
  assert (select reply_count from public.community_topics where id = tp) = 0, 'sem respostas';
  assert pg_temp.run_as('authenticated', e, format($q$insert into public.community_topics (community_id, title, body) values (%L, 'Do criador', 'ok')$q$, co)) = 'rows=1', 'criador (moderador) também publica';
  assert pg_temp.run_as('authenticated', t, format($q$insert into public.community_topics (community_id, title, body) values (%L, 'Intruso', 'sou nao membro')$q$, co)) = 'erro=42501', '2: não membro NÃO cria tópico (RLS, pela API)';
  assert pg_temp.run_as('authenticated', x, format($q$insert into public.community_topics (community_id, title, body) values (%L, 'Pendente', 'ainda nao sou membro')$q$, cap)) = 'erro=42501', 'solicitação pendente não dá permissão';
  assert pg_temp.run_as('authenticated', k, format($q$insert into public.community_topics (community_id, title, body) values (%L, 'Em outra comunidade', 'nao sou membro la')$q$, co2)) = 'erro=42501', 'membro de A não publica em B';
  assert pg_temp.run_as('anon', null, format($q$insert into public.community_topics (community_id, title, body) values (%L, 'Anon', 'x')$q$, co)) like 'erro=%', 'anon não publica';
  assert pg_temp.run_as('anon', null, $q$select 1 from public.community_topics$q$) like 'erro=%', 'anon não lê';
  raise notice 'OK: criar tópico (membro sim; não membro, pendente, outra comunidade e anon não)';

  -- ===================================================== CAMPOS PROTEGIDOS
  assert pg_temp.run_as('authenticated', k, format($q$insert into public.community_topics (community_id, title, body, author_id) values (%L, 'Forjado', 'x', %L)$q$, co, e)) like 'erro=%', 'cliente não informa author_id';
  assert pg_temp.run_as('authenticated', k, format($q$insert into public.community_topics (community_id, title, body, reply_count) values (%L, 'Forjado', 'x', 99)$q$, co)) like 'erro=%', 'cliente não informa reply_count';
  assert pg_temp.run_as('authenticated', k, format($q$insert into public.community_topics (community_id, title, body, last_activity_at) values (%L, 'Forjado', 'x', now() + interval '10 years')$q$, co)) like 'erro=%', 'cliente não informa last_activity_at';
  assert pg_temp.run_as('authenticated', k, format($q$update public.community_topics set title = 'Editado' where id = %L$q$, tp)) like 'erro=%', 'sem UPDATE de título (nem do autor)';
  assert pg_temp.run_as('authenticated', k, format($q$update public.community_topics set community_id = %L where id = %L$q$, co2, tp)) like 'erro=%', 'não move tópico para outra comunidade';
  assert pg_temp.run_as('authenticated', k, format($q$update public.community_topics set author_id = %L where id = %L$q$, e, tp)) like 'erro=%', 'não troca o autor';
  assert pg_temp.run_as('authenticated', e, format($q$update public.community_topics set title = 'Moderador edita' where id = %L$q$, tp)) like 'erro=%', 'nem moderador edita (não há edição)';
  raise notice 'OK: autor/comunidade/contadores imutáveis e não informáveis pelo cliente';

  -- ===================================================== 3: COMENTAR
  before_ts := (select last_activity_at from public.community_topics where id = tp);
  assert pg_temp.run_as('authenticated', e, format($q$insert into public.community_topic_replies (topic_id, body) values (%L, 'Comentário do criador :D')$q$, tp)) = 'rows=1', '3: membro comenta';
  select id into c1 from public.community_topic_replies where topic_id = tp and body like 'Comentário do criador%';
  assert (select author_id from public.community_topic_replies where id = c1) = e::uuid, 'autor do comentário = auth.uid';
  assert (select community_id from public.community_topic_replies where id = c1) = co, 'community_id copiado do tópico pelo gatilho';
  assert (select parent_id from public.community_topic_replies where id = c1) is null, 'comentário é raiz';
  assert (select reply_count from public.community_topics where id = tp) = 1, 'contador = 1';
  assert (select last_activity_at from public.community_topics where id = tp) >= before_ts, 'última atividade não retrocede';
  assert pg_temp.run_as('authenticated', t, format($q$insert into public.community_topic_replies (topic_id, body) values (%L, 'sou nao membro')$q$, tp)) = 'erro=42501', '8: não membro NÃO comenta (RLS, pela API)';
  assert pg_temp.run_as('authenticated', x, format($q$insert into public.community_topic_replies (topic_id, body) values (%L, 'pendente')$q$, tp)) = 'erro=42501', 'pendente não comenta';
  assert pg_temp.run_as('authenticated', k, format($q$insert into public.community_topic_replies (topic_id, community_id, body) values (%L, %L, 'tentando forjar a comunidade')$q$, tp, co2)) like 'erro=%', 'cliente não informa community_id da mensagem';
  assert pg_temp.run_as('authenticated', k, format($q$insert into public.community_topic_replies (topic_id, body, author_id) values (%L, 'forjando autor', %L)$q$, tp, e)) like 'erro=%', 'cliente não informa author_id da mensagem';
  assert pg_temp.run_as('authenticated', k, format($q$insert into public.community_topic_replies (topic_id, body) values (%L, 'topico inexistente')$q$, gen_random_uuid())) like 'erro=%', 'tópico inexistente';
  raise notice 'OK: comentários (membro sim; não membro/pendente/forjar não)';

  -- ===================================================== 4: RESPONDER (1 nível)
  assert pg_temp.run_as('authenticated', k, format($q$insert into public.community_topic_replies (topic_id, parent_id, body) values (%L, %L, 'Resposta do K')$q$, tp, c1)) = 'rows=1', '4: membro responde a comentário';
  select id into r1 from public.community_topic_replies where parent_id = c1;
  assert (select topic_id from public.community_topic_replies where id = r1) = tp, 'resposta no mesmo tópico';
  assert (select reply_count from public.community_topics where id = tp) = 2, 'contador conta respostas também';
  assert pg_temp.run_as('authenticated', e, format($q$insert into public.community_topic_replies (topic_id, parent_id, body) values (%L, %L, 'Resposta a resposta')$q$, tp, r1)) = 'erro=23514', 'NÃO se responde a uma resposta (1 nível)';
  assert pg_temp.run_as('authenticated', t, format($q$insert into public.community_topic_replies (topic_id, parent_id, body) values (%L, %L, 'nao membro responde')$q$, tp, c1)) = 'erro=42501', 'não membro não responde';
  -- comentário de OUTRO tópico não serve de pai
  assert pg_temp.run_as('authenticated', k, format($q$insert into public.community_topics (community_id, title, body) values (%L, 'Segundo tópico', 'corpo')$q$, co)) = 'rows=1';
  select id into tp2 from public.community_topics where title = 'Segundo tópico';
  assert pg_temp.run_as('authenticated', k, format($q$insert into public.community_topic_replies (topic_id, parent_id, body) values (%L, %L, 'pai de outro topico')$q$, tp2, c1)) = 'erro=23503', 'pai precisa ser do mesmo tópico';
  assert pg_temp.run_as('authenticated', k, format($q$insert into public.community_topic_replies (topic_id, parent_id, body) values (%L, %L, 'pai inexistente')$q$, tp, gen_random_uuid())) like 'erro=%', 'pai inexistente';
  raise notice 'OK: respostas de 1 nível, no mesmo tópico, só por membros';

  -- ===================================================== LEITURA
  assert pg_temp.val('authenticated', t, format($q$select count(*)::text from public.community_topics where community_id = %L$q$, co)) = '3', 'não membro LÊ os tópicos (decisão: leitura aberta)';
  assert pg_temp.val('authenticated', t, format($q$select count(*)::text from public.community_topic_replies where topic_id = %L$q$, tp)) = '2', 'não membro lê as mensagens';
  assert pg_temp.val('authenticated', x, format($q$select count(*)::text from public.community_topics where community_id = %L$q$, co)) = '3', 'qualquer autenticado lê';
  raise notice 'OK: leitura aberta a qualquer usuário autenticado';

  -- ===================================================== 6 e 7: EXCLUIR
  assert pg_temp.run_as('authenticated', t, format($q$delete from public.community_topic_replies where id = %L$q$, r1)) = 'rows=0', 'não membro não apaga';
  assert pg_temp.run_as('authenticated', y, format($q$delete from public.community_topic_replies where id = %L$q$, r1)) = 'rows=0', 'outro membro comum não apaga mensagem alheia';
  assert pg_temp.run_as('authenticated', y, format($q$delete from public.community_topics where id = %L$q$, tp)) = 'rows=0', 'outro membro comum não apaga tópico alheio';
  assert pg_temp.run_as('authenticated', k, format($q$delete from public.community_topic_replies where id = %L$q$, r1)) = 'rows=1', '6: autor apaga a PRÓPRIA resposta';
  assert (select reply_count from public.community_topics where id = tp) = 1, 'contador recalculado ao apagar';
  assert pg_temp.run_as('authenticated', k, format($q$insert into public.community_topic_replies (topic_id, parent_id, body) values (%L, %L, 'Resposta imprópria')$q$, tp, c1)) = 'rows=1';
  assert pg_temp.run_as('authenticated', k, format($q$insert into public.community_topic_replies (topic_id, parent_id, body) values (%L, %L, 'Outra resposta')$q$, tp, c1)) = 'rows=1';
  assert (select reply_count from public.community_topics where id = tp) = 3, 'contador = 3 (1 comentário + 2 respostas)';
  select id into r2 from public.community_topic_replies where body = 'Resposta imprópria';
  assert pg_temp.run_as('authenticated', m, format($q$delete from public.community_topic_replies where id = %L$q$, r2)) = 'rows=1', '7: moderador apaga resposta inadequada';
  assert (select reply_count from public.community_topics where id = tp) = 2, 'contador = 2 após moderação';
  -- comentário do K, moderador apaga (cascata nas respostas)
  assert pg_temp.run_as('authenticated', k, format($q$insert into public.community_topic_replies (topic_id, body) values (%L, 'Comentário inadequado')$q$, tp)) = 'rows=1';
  select id into cm from public.community_topic_replies where body = 'Comentário inadequado';
  assert pg_temp.run_as('authenticated', e, format($q$insert into public.community_topic_replies (topic_id, parent_id, body) values (%L, %L, 'resposta ao inadequado')$q$, tp, cm)) = 'rows=1';
  assert (select reply_count from public.community_topics where id = tp) = 4, 'contador = 4';
  assert pg_temp.run_as('authenticated', m, format($q$delete from public.community_topic_replies where id = %L$q$, cm)) = 'rows=1', 'moderador apaga comentário inadequado';
  assert not exists (select 1 from public.community_topic_replies where parent_id = cm), 'respostas do comentário apagado somem junto';
  assert (select reply_count from public.community_topics where id = tp) = 2, 'contador recalculado após cascata (2: comentário + 1 resposta)';
  assert (select last_activity_at from public.community_topics where id = tp) = (select max(created_at) from public.community_topic_replies where topic_id = tp), 'última atividade = mensagem mais recente que sobrou';
  -- tópico: moderador apaga tópico alheio
  assert pg_temp.run_as('authenticated', m, format($q$delete from public.community_topics where id = %L$q$, tp2)) = 'rows=1', 'moderador apaga tópico inadequado';
  assert not exists (select 1 from public.community_topics where id = tp2), 'tópico some';
  -- criador (moderador) apaga tópico; autor apaga o próprio
  assert pg_temp.run_as('authenticated', k, format($q$insert into public.community_topics (community_id, title, body) values (%L, 'Tópico do K', 'corpo')$q$, co)) = 'rows=1';
  select id into tpm from public.community_topics where title = 'Tópico do K';
  assert pg_temp.run_as('authenticated', e, format($q$insert into public.community_topic_replies (topic_id, body) values (%L, 'comentário no tópico do K')$q$, tpm)) = 'rows=1';
  assert pg_temp.run_as('authenticated', k, format($q$delete from public.community_topics where id = %L$q$, tpm)) = 'rows=1', 'autor apaga o próprio tópico';
  assert not exists (select 1 from public.community_topic_replies where topic_id = tpm), 'mensagens do tópico apagado somem junto';
  assert pg_temp.run_as('authenticated', x, format($q$delete from public.community_topics where id = %L$q$, tp)) = 'rows=0', 'não membro não apaga';
  raise notice 'OK: exclusão (autor; moderador/criador; cascata e contador)';

  -- ===================================================== 9: REMOVIDO PERDE PERMISSÃO
  assert pg_temp.run_as('authenticated', m, format($q$delete from public.community_members where community_id = %L and user_id = %L$q$, co, k)) = 'rows=1', 'moderador remove K da comunidade';
  assert pg_temp.run_as('authenticated', k, format($q$insert into public.community_topics (community_id, title, body) values (%L, 'Depois de removido', 'x')$q$, co)) = 'erro=42501', '9: removido não cria tópico';
  assert pg_temp.run_as('authenticated', k, format($q$insert into public.community_topic_replies (topic_id, body) values (%L, 'Depois de removido')$q$, tp)) = 'erro=42501', '9: removido não comenta';
  assert pg_temp.run_as('authenticated', k, format($q$insert into public.community_topic_replies (topic_id, parent_id, body) values (%L, %L, 'Depois de removido')$q$, tp, c1)) = 'erro=42501', '9: removido não responde';
  assert pg_temp.run_as('authenticated', k, format($q$delete from public.community_topic_replies where id = %L$q$, (select id from public.community_topic_replies where body = 'Outra resposta'))) = 'rows=1', 'removido ainda apaga o que ELE escreveu';
  assert pg_temp.run_as('authenticated', k, format($q$insert into public.community_members (community_id) values (%L)$q$, co)) = 'rows=1', 'K reentra (comunidade aberta)';
  assert pg_temp.run_as('authenticated', k, format($q$insert into public.community_topics (community_id, title, body) values (%L, 'Voltei', 'x')$q$, co)) = 'rows=1', 'ao reentrar volta a publicar';
  raise notice 'OK: usuário removido perde a permissão de publicar (e recupera ao reentrar)';

  -- ===================================================== LIMITES E TEXTO
  assert pg_temp.run_as('authenticated', m, format($q$insert into public.community_topics (community_id, title, body) values (%L, 'ab', 'x')$q$, co)) like 'erro=%', 'título curto (2)';
  assert pg_temp.run_as('authenticated', m, format($q$insert into public.community_topics (community_id, title, body) values (%L, %L, 'x')$q$, co, repeat('t', 121))) like 'erro=%', 'título longo (121)';
  assert pg_temp.run_as('authenticated', m, format($q$insert into public.community_topics (community_id, title, body) values (%L, 'Título ok', '   ')$q$, co)) like 'erro=%', 'mensagem só com espaços';
  assert pg_temp.run_as('authenticated', m, format($q$insert into public.community_topics (community_id, title, body) values (%L, '   ', 'corpo')$q$, co)) like 'erro=%', 'título só com espaços';
  assert pg_temp.run_as('authenticated', m, format($q$insert into public.community_topics (community_id, title, body) values (%L, 'Título ok', %L)$q$, co, repeat('b', 5001))) like 'erro=%', 'mensagem inicial > 5000';
  assert pg_temp.run_as('authenticated', m, format($q$insert into public.community_topics (community_id, title, body) values (%L, %L, %L)$q$, co, repeat('t', 120), repeat('b', 5000))) = 'rows=1', 'limites exatos (120 / 5000) passam';
  assert pg_temp.run_as('authenticated', m, format($q$insert into public.community_topic_replies (topic_id, body) values (%L, '')$q$, tp)) like 'erro=%', 'comentário vazio';
  assert pg_temp.run_as('authenticated', m, format($q$insert into public.community_topic_replies (topic_id, body) values (%L, %L)$q$, tp, repeat('c', 2001))) like 'erro=%', 'comentário > 2000';
  assert pg_temp.run_as('authenticated', m, format($q$insert into public.community_topic_replies (topic_id, body) values (%L, %L)$q$, tp, repeat('c', 2000))) = 'rows=1', 'comentário de 2000 passa';
  -- HTML é guardado como texto puro (a tela não o interpreta); caracteres de controle somem
  assert pg_temp.run_as('authenticated', m, format($q$insert into public.community_topic_replies (topic_id, body) values (%L, E'<script>alert(1)</script> <b>x</b>\x01\x07 fim')$q$, tp)) = 'rows=1';
  assert (select body from public.community_topic_replies where body like '<script>%') = '<script>alert(1)</script> <b>x</b> fim', 'HTML guardado literal; controle removido';
  raise notice 'OK: limites de tamanho, texto normalizado, HTML tratado como texto';

  -- ===================================================== ANTI-ABUSO
  assert pg_temp.run_as('authenticated', y, format($q$insert into public.community_topic_replies (topic_id, body) values (%L, 'igual')$q$, tp)) = 'rows=1';
  assert pg_temp.run_as('authenticated', y, format($q$insert into public.community_topic_replies (topic_id, body) values (%L, 'igual')$q$, tp)) = 'erro=23505', 'mensagem idêntica repetida é recusada';
  assert pg_temp.run_as('authenticated', y, format($q$insert into public.community_topic_replies (topic_id, body) values (%L, 'igual')$q$, tp2)) like 'erro=%', 'tópico apagado não aceita';
  for i in 1..14 loop
    assert pg_temp.run_as('authenticated', y, format($q$insert into public.community_topic_replies (topic_id, body) values (%L, %L)$q$, tp, 'flood ' || i)) = 'rows=1', 'mensagem ' || i || ' dentro do limite';
  end loop;
  assert pg_temp.run_as('authenticated', y, format($q$insert into public.community_topic_replies (topic_id, body) values (%L, 'flood 15')$q$, tp)) = 'erro=54000', 'a 16ª mensagem no minuto é recusada';
  assert pg_temp.run_as('authenticated', e, format($q$insert into public.community_topic_replies (topic_id, body) values (%L, 'outro autor segue livre')$q$, tp)) = 'rows=1', 'o limite é por autor';
  for i in 1..5 loop
    assert pg_temp.run_as('authenticated', y, format($q$insert into public.community_topics (community_id, title, body) values (%L, %L, 'x')$q$, co, 'Tópico flood ' || i)) = 'rows=1', 'tópico ' || i || ' dentro do limite';
  end loop;
  assert pg_temp.run_as('authenticated', y, format($q$insert into public.community_topics (community_id, title, body) values (%L, 'Tópico flood 6', 'x')$q$, co)) = 'erro=54000', 'o 6º tópico em 10 min é recusado';
  raise notice 'OK: anti-abuso (repetição e frequência, por autor)';

  -- ===================================================== INTEGRIDADE
  -- conta excluída: conversa permanece, autor fica nulo
  select id into tpm from public.community_topics where title = 'Voltei';
  assert pg_temp.run_as('authenticated', m, format($q$insert into public.community_topic_replies (topic_id, body) values (%L, 'comentario do M no topico do K')$q$, tpm)) = 'rows=1';
  delete from auth.users where id = k::uuid;
  assert exists (select 1 from public.community_topics where id = tpm and author_id is null), 'tópico permanece, autor nulo (conta excluída)';
  assert exists (select 1 from public.community_topic_replies where topic_id = tpm), 'mensagens permanecem';
  -- ordenação por atividade
  assert (select id from public.community_topics where community_id = co order by last_activity_at desc, id desc limit 1) is not null;
  -- apagar a comunidade apaga o fórum
  assert pg_temp.run_as('authenticated', e, format($q$delete from public.communities where id = %L$q$, co)) = 'rows=1', 'criador apaga a comunidade';
  assert not exists (select 1 from public.community_topics where community_id = co), 'tópicos somem com a comunidade';
  assert not exists (select 1 from public.community_topic_replies where community_id = co), 'mensagens somem com a comunidade';
  assert (select count(*) from public.communities where id in (cap, co2)) = 2, 'outras comunidades intactas';
  raise notice 'OK: integridade (conta excluída, cascata da comunidade, outras comunidades intactas)';

  raise notice 'TODOS OS TESTES DO FÓRUM PASSARAM';
end $$;

rollback;
