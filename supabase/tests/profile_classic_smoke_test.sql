-- =============================================================================
-- EdKut — Teste de fumaça da migração 14 (perfil clássico: status, dados pessoais, fãs, fotos, vídeos)
--
-- Rode DEPOIS de aplicar 20261117100001_profile_classic.sql, SOMENTE em projeto de DESENVOLVIMENTO, no SQL
-- Editor, o arquivo inteiro de uma vez. Cria 3 usuários de teste e termina em ROLLBACK (não deixa dados).
-- Esperado: várias mensagens "OK: ..." e, no fim, "TODOS OS TESTES DO PERFIL CLÁSSICO PASSARAM".
-- LIMITE: o tamanho (5 MB) e os tipos MIME do bucket são impostos pela API do Storage, não por SQL.
-- =============================================================================
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice-classic@edkut.test', '{}'::jsonb),
  ('00000000-0000-0000-0000-0000000000b2', 'bob-classic@edkut.test',   '{}'::jsonb),
  ('00000000-0000-0000-0000-0000000000c3', 'carol-classic@edkut.test', '{}'::jsonb);

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

do $$
declare
  A constant text := '00000000-0000-0000-0000-0000000000a1';
  B constant text := '00000000-0000-0000-0000-0000000000b2';
  C constant text := '00000000-0000-0000-0000-0000000000c3';
  r text;
begin
  -- ===== profiles: status, relacionamento, aniversário, hobbies =================
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set status_phrase = 'Sou feito de luz, cor e alegria!' where id = %L$q$, A)) = 'rows=1', 'dono edita o status';
  assert pg_temp.run_as('authenticated', B, format($q$update public.profiles set status_phrase = 'invadido' where id = %L$q$, A)) = 'rows=0', 'outra pessoa NÃO edita o status';
  assert (select status_phrase from public.profiles where id = A::uuid) = 'Sou feito de luz, cor e alegria!', 'status segue intacto';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set status_phrase = %L where id = %L$q$, repeat('a', 100), A)) = 'rows=1', '100 caracteres ok';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set status_phrase = %L where id = %L$q$, repeat('a', 101), A)) = 'erro=23514', '101 caracteres violam o CHECK';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set status_phrase = '   ' where id = %L$q$, A)) = 'erro=23514', 'status só com espaços viola o CHECK';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set status_phrase = '' where id = %L$q$, A)) = 'erro=23514', 'string vazia viola (o app grava NULL)';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set status_phrase = null where id = %L$q$, A)) = 'rows=1', 'remover o status (NULL) funciona';
  assert pg_temp.run_as('anon', null, format($q$update public.profiles set status_phrase = 'x' where id = %L$q$, A)) = 'erro=42501', 'anon não atualiza perfis';
  raise notice 'OK: status — só o dono edita, limite de 100, vazio => NULL, anon bloqueado';

  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set relationship = 'namorando', birthday = '1990-04-12', hobbies = 'xadrez, trilhas' where id = %L$q$, A)) = 'rows=1', 'dados pessoais válidos';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set relationship = 'qualquer' where id = %L$q$, A)) = 'erro=23514', 'relacionamento fora da lista';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set birthday = '1800-01-01' where id = %L$q$, A)) = 'erro=23514', 'aniversário antes de 1900';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set hobbies = %L where id = %L$q$, repeat('h', 301), A)) = 'erro=23514', 'hobbies > 300';
  assert pg_temp.run_as('authenticated', B, format($q$update public.profiles set hobbies = 'invadido' where id = %L$q$, A)) = 'rows=0', 'outra pessoa NÃO edita hobbies';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set bio = 'olá', location = 'Vitória, ES' where id = %L$q$, A)) = 'rows=1', 'colunas antigas seguem editáveis';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set avatar_url = 'https://x' where id = %L$q$, A)) = 'erro=42501', 'avatar_url segue protegido';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set created_at = now() where id = %L$q$, A)) = 'erro=42501', 'created_at segue protegido';
  raise notice 'OK: relacionamento/aniversário/hobbies validados; colunas protegidas continuam protegidas';

  -- ===== fãs =======================================================================
  assert pg_temp.run_as('authenticated', A, format($q$insert into public.profile_fans (profile_id) values (%L)$q$, B)) = 'rows=1', 'Alice vira fã do Bob';
  assert pg_temp.run_as('authenticated', A, format($q$insert into public.profile_fans (profile_id) values (%L)$q$, B)) = 'erro=23505', 'fã duplicado';
  assert pg_temp.run_as('authenticated', A, format($q$insert into public.profile_fans (profile_id) values (%L)$q$, A)) = 'erro=23514', 'ninguém é fã de si mesmo';
  assert pg_temp.run_as('authenticated', A, format($q$insert into public.profile_fans (fan_id, profile_id) values (%L, %L)$q$, C, B)) = 'erro=42501', 'não dá para forjar fan_id (coluna sem grant)';
  assert pg_temp.run_as('authenticated', C, format($q$insert into public.profile_fans (profile_id) values (%L)$q$, B)) = 'rows=1', 'Carol também vira fã do Bob';
  assert pg_temp.run_as('authenticated', C, $q$select * from public.profile_fans$q$) = 'rows=2', 'qualquer autenticado vê os fãs (contador público)';
  assert pg_temp.run_as('authenticated', C, format($q$delete from public.profile_fans where fan_id = %L$q$, A)) = 'rows=0', 'não dá para desfazer o "sou fã" de outra pessoa';
  assert pg_temp.run_as('authenticated', B, format($q$delete from public.profile_fans where profile_id = %L$q$, B)) = 'rows=0', 'nem o dono do perfil remove fãs dos outros';
  assert pg_temp.run_as('authenticated', A, format($q$delete from public.profile_fans where fan_id = %L and profile_id = %L$q$, A, B)) = 'rows=1', 'a pessoa desfaz o próprio "sou fã"';
  assert pg_temp.run_as('anon', null, $q$select * from public.profile_fans$q$) = 'erro=42501', 'anon não lê fãs';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profile_fans set profile_id = %L where fan_id = %L$q$, A, C)) = 'erro=42501', 'sem UPDATE em fãs';
  raise notice 'OK: fãs — próprio, sem duplicata, sem auto-fã, sem forjar, contador legível, anon bloqueado';

  -- ===== fotos =====================================================================
  assert pg_temp.run_as('authenticated', A, format($q$insert into public.profile_photos (path, caption) values (%L, 'Praia')$q$, A || '/foto1.jpg')) = 'rows=1', 'Alice cadastra foto na própria pasta';
  assert (select owner_id from public.profile_photos where path = A || '/foto1.jpg') = A::uuid, 'owner_id vem de auth.uid()';
  assert pg_temp.run_as('authenticated', A, format($q$insert into public.profile_photos (owner_id, path) values (%L, %L)$q$, B, B || '/x.jpg')) = 'erro=42501', 'owner_id não pode ser informado';
  assert pg_temp.run_as('authenticated', A, format($q$insert into public.profile_photos (path) values (%L)$q$, B || '/x.jpg')) = 'erro=23514', 'caminho na pasta de outra pessoa viola o CHECK';
  assert pg_temp.run_as('authenticated', A, format($q$insert into public.profile_photos (path) values (%L)$q$, A || '/../' || B || '/x.jpg')) = 'erro=23514', 'path traversal';
  assert pg_temp.run_as('authenticated', A, format($q$insert into public.profile_photos (path) values (%L)$q$, A || '/sub/x.jpg')) = 'erro=23514', 'subpasta';
  assert pg_temp.run_as('authenticated', A, format($q$insert into public.profile_photos (path) values (%L)$q$, A || '/x.gif')) = 'erro=23514', 'extensão não permitida';
  assert pg_temp.run_as('authenticated', A, format($q$insert into public.profile_photos (path) values (%L)$q$, 'https://evil.example/' || A || '/x.jpg')) = 'erro=23514', 'URL externa';
  assert pg_temp.run_as('authenticated', A, format($q$insert into public.profile_photos (path, caption) values (%L, %L)$q$, A || '/foto2.png', repeat('c', 141))) = 'erro=23514', 'legenda > 140';
  assert pg_temp.run_as('authenticated', A, format($q$insert into public.profile_photos (path) values (%L)$q$, A || '/foto1.jpg')) = 'erro=23505', 'mesmo caminho duas vezes';
  assert pg_temp.run_as('authenticated', B, $q$select * from public.profile_photos$q$) = 'rows=1', 'outro usuário autenticado vê as fotos';
  assert pg_temp.run_as('anon', null, $q$select * from public.profile_photos$q$) = 'erro=42501', 'anon não vê fotos';
  assert pg_temp.run_as('authenticated', B, format($q$delete from public.profile_photos where owner_id = %L$q$, A)) = 'rows=0', 'Bob NÃO apaga foto da Alice';
  assert pg_temp.run_as('authenticated', B, format($q$update public.profile_photos set caption = 'invadida' where owner_id = %L$q$, A)) = 'rows=0', 'Bob NÃO altera legenda da Alice';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profile_photos set caption = 'Praia do Sul' where owner_id = %L$q$, A)) = 'rows=1', 'dona altera a legenda';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profile_photos set path = %L where owner_id = %L$q$, A || '/outra.jpg', A)) = 'erro=42501', 'path não é editável';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profile_photos set owner_id = %L where owner_id = %L$q$, B, A)) = 'erro=42501', 'não dá para transferir a foto';
  assert pg_temp.run_as('authenticated', A, format($q$delete from public.profile_photos where owner_id = %L$q$, A)) = 'rows=1', 'dona apaga a própria foto';
  raise notice 'OK: fotos — pasta própria, CHECKs de caminho/legenda, leitura autenticada, só a dona altera/apaga';

  -- cota de 100 fotos
  assert pg_temp.run_as('authenticated', A, format($q$insert into public.profile_photos (path) select %L || g || '.png' from generate_series(1, 100) g$q$, A || '/q')) = 'rows=100', '100 fotos cabem';
  assert pg_temp.run_as('authenticated', A, format($q$insert into public.profile_photos (path) values (%L)$q$, A || '/q101.png')) = 'erro=54000', 'a 101ª foto é recusada';
  assert pg_temp.run_as('authenticated', B, format($q$insert into public.profile_photos (path) values (%L)$q$, B || '/ok.png')) = 'rows=1', 'a cota é por pessoa';
  raise notice 'OK: cota de 100 fotos por pessoa';

  -- ===== vídeos ====================================================================
  assert pg_temp.run_as('authenticated', A, $q$insert into public.profile_videos (youtube_id, title, description) values ('dQw4w9WgXcQ', 'Clipe', 'Um clássico')$q$) = 'rows=1', 'vídeo válido';
  assert pg_temp.run_as('authenticated', A, $q$insert into public.profile_videos (youtube_id) values ('dQw4w9WgXcQ')$q$) = 'erro=23505', 'mesmo vídeo duas vezes';
  assert pg_temp.run_as('authenticated', A, $q$insert into public.profile_videos (youtube_id) values ('curto')$q$) = 'erro=23514', 'id curto demais';
  assert pg_temp.run_as('authenticated', A, $q$insert into public.profile_videos (youtube_id) values ('https://youtu.be/dQw4w9WgXcQ')$q$) = 'erro=23514', 'URL não é aceita: só o id de 11 caracteres';
  assert pg_temp.run_as('authenticated', A, $q$insert into public.profile_videos (youtube_id) values ('abc"><script')$q$) = 'erro=23514', 'caracteres perigosos no id';
  assert pg_temp.run_as('authenticated', A, format($q$insert into public.profile_videos (youtube_id, title) values ('abcdefghijk', %L)$q$, repeat('t', 101))) = 'erro=23514', 'título > 100';
  assert pg_temp.run_as('authenticated', A, format($q$insert into public.profile_videos (youtube_id, description) values ('abcdefghijk', %L)$q$, repeat('d', 301))) = 'erro=23514', 'descrição > 300';
  assert pg_temp.run_as('authenticated', A, format($q$insert into public.profile_videos (owner_id, youtube_id) values (%L, 'abcdefghijk')$q$, B)) = 'erro=42501', 'owner_id não pode ser informado';
  assert pg_temp.run_as('authenticated', B, $q$insert into public.profile_videos (youtube_id) values ('dQw4w9WgXcQ')$q$) = 'rows=1', 'o mesmo vídeo pode estar no perfil de outra pessoa';
  assert pg_temp.run_as('authenticated', C, $q$select * from public.profile_videos$q$) = 'rows=2', 'autenticados veem vídeos';
  assert pg_temp.run_as('anon', null, $q$select * from public.profile_videos$q$) = 'erro=42501', 'anon não vê vídeos';
  assert pg_temp.run_as('authenticated', C, format($q$delete from public.profile_videos where owner_id = %L$q$, A)) = 'rows=0', 'Carol NÃO apaga vídeo da Alice';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profile_videos set title = 'x' where owner_id = %L$q$, A)) = 'erro=42501', 'sem UPDATE em vídeos';
  assert pg_temp.run_as('authenticated', A, format($q$delete from public.profile_videos where owner_id = %L$q$, A)) = 'rows=1', 'dona apaga o próprio vídeo';
  assert pg_temp.run_as('authenticated', A, $q$insert into public.profile_videos (youtube_id) select 'video' || lpad(g::text, 6, '0') from generate_series(1, 50) g$q$) = 'rows=50', '50 vídeos cabem';
  assert pg_temp.run_as('authenticated', A, $q$insert into public.profile_videos (youtube_id) values ('video999999')$q$) = 'erro=54000', 'o 51º vídeo é recusado';
  raise notice 'OK: vídeos — só id de 11 caracteres, sem duplicata, limites, só a dona apaga, cota de 50';

  -- ===== Storage (bucket profile-photos) ===========================================
  assert exists (select 1 from storage.buckets where id = 'profile-photos' and public), 'bucket profile-photos existe e é público';
  assert pg_temp.run_as('authenticated', A, format($q$insert into storage.objects (bucket_id, name, owner) values ('profile-photos', %L, %L)$q$, A || '/a.png', A)) = 'rows=1', 'upload na própria pasta';
  assert pg_temp.run_as('authenticated', A, format($q$insert into storage.objects (bucket_id, name, owner) values ('profile-photos', %L, %L)$q$, B || '/a.png', A)) = 'erro=42501', 'upload na pasta de outra pessoa é recusado';
  assert pg_temp.run_as('authenticated', A, format($q$insert into storage.objects (bucket_id, name, owner) values ('profile-photos', %L, %L)$q$, A || '/s/a.png', A)) = 'erro=42501', 'subpasta recusada';
  assert pg_temp.run_as('authenticated', A, format($q$insert into storage.objects (bucket_id, name, owner) values ('profile-photos', %L, %L)$q$, A || '/a.gif', A)) = 'erro=42501', 'extensão recusada';
  assert pg_temp.run_as('anon', null, format($q$insert into storage.objects (bucket_id, name) values ('profile-photos', %L)$q$, A || '/z.png')) = 'erro=42501', 'anon não envia';
  insert into storage.objects (bucket_id, name, owner) values ('profile-photos', B || '/bob.png', B::uuid);
  assert pg_temp.run_as('authenticated', A, format($q$delete from storage.objects where bucket_id = 'profile-photos' and name = %L$q$, B || '/bob.png')) = 'rows=0', 'Alice não apaga arquivo do Bob';
  assert pg_temp.run_as('authenticated', A, format($q$delete from storage.objects where bucket_id = 'profile-photos' and name = %L$q$, A || '/a.png')) = 'rows=1', 'Alice apaga o próprio arquivo';
  raise notice 'OK: Storage — só a própria pasta, nome simples, extensão de imagem; apagar só o próprio';

  -- ===== exclusão de conta limpa tudo ============================================
  delete from auth.users where id = A::uuid;
  assert not exists (select 1 from public.profile_photos where owner_id = A::uuid), 'fotos somem com a conta';
  assert not exists (select 1 from public.profile_videos where owner_id = A::uuid), 'vídeos somem com a conta';
  assert not exists (select 1 from public.profile_fans where fan_id = A::uuid or profile_id = A::uuid), 'fãs somem com a conta';
  raise notice 'OK: CASCADE na exclusão da conta';

  raise notice 'TODOS OS TESTES DO PERFIL CLÁSSICO PASSARAM';
end $$;

rollback;
