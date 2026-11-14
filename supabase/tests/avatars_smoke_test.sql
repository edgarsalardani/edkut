-- =============================================================================
-- EdKut — Teste de fumaça da migração 8 (foto de perfil: Storage + profiles.avatar_path)
--
-- Rode DEPOIS de aplicar 20261114140001_avatars_storage.sql, SOMENTE em projeto de
-- DESENVOLVIMENTO, no SQL Editor, o arquivo inteiro de uma vez. Tudo termina em ROLLBACK
-- (cria 2 usuários de teste em auth.users e 2 registros em storage.objects, e desfaz).
-- Se uma verificação falhar, o script para com a mensagem do ASSERT; nesse caso rode ROLLBACK;
-- Esperado: várias mensagens "OK: ..." e, no fim, "TODOS OS TESTES DE AVATAR PASSARAM".
--
-- LIMITES: o tamanho máximo (2 MB) e os tipos MIME do bucket são impostos pela API do Storage,
-- não por SQL — teste-os pelo app (arquivo > 2 MB, .gif).
-- =============================================================================
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice-avatar@edkut.test', '{}'::jsonb),
  ('00000000-0000-0000-0000-0000000000b2', 'bob-avatar@edkut.test',   '{}'::jsonb);

-- arquivo que já pertence ao Bob (criado como administrador)
insert into storage.objects (bucket_id, name, owner)
values ('avatars', '00000000-0000-0000-0000-0000000000b2/bob.png', '00000000-0000-0000-0000-0000000000b2');

-- Executa um comando SQL "como" um usuário logado (role authenticated + JWT com sub = uid)
-- ou como anônimo (uid nulo). Devolve 'rows=N' ou 'erro=<SQLSTATE>'.
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
begin
  -- ===== profiles: o que o usuário PODE e NÃO PODE atualizar ======================
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set avatar_path = %L where id = %L$q$, A || '/foto.png', A)) = 'rows=1',
    'Alice deveria conseguir definir a PRÓPRIA foto';
  raise notice 'OK: usuário atualiza a própria foto (avatar_path) — grant por coluna + profiles_update_own funcionam juntos';

  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set avatar_path = %L, bio = 'olá' where id = %L$q$, A || '/foto2.webp', A)) = 'rows=1',
    'Alice deveria poder atualizar foto + bio na mesma instrução (colunas já liberadas)';
  raise notice 'OK: foto + campos já liberados (bio) na mesma instrução';

  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set avatar_path = null where id = %L$q$, A)) = 'rows=1',
    'Alice deveria poder remover a própria foto (NULL)';
  raise notice 'OK: remover a foto (NULL)';

  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set avatar_path = %L where id = %L$q$, A || '/foto.png', B)) = 'rows=0',
    'Alice NÃO pode alterar o perfil do Bob (RLS filtra: 0 linhas)';
  assert (select avatar_path from public.profiles where id = B::uuid) is null, 'perfil do Bob deveria seguir intacto';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set bio = 'invadido' where id = %L$q$, B)) = 'rows=0',
    'Alice NÃO pode alterar a bio do Bob';
  raise notice 'OK: não é possível alterar o perfil (nem a foto) de outra pessoa';

  -- constraint: só a PRÓPRIA pasta, só nome simples, só jpg/png/webp, sem domínio/URL
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set avatar_path = %L where id = %L$q$, B || '/bob.png', A)) = 'erro=23514',
    'avatar_path apontando para a pasta do Bob deveria violar o CHECK';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set avatar_path = %L where id = %L$q$, 'https://evil.example/storage/v1/object/public/avatars/' || A || '/x.png', A)) = 'erro=23514',
    'URL externa deveria violar o CHECK';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set avatar_path = %L where id = %L$q$, A || '/../' || B || '/bob.png', A)) = 'erro=23514',
    'path traversal deveria violar o CHECK';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set avatar_path = %L where id = %L$q$, A || '/sub/x.png', A)) = 'erro=23514',
    'subpasta deveria violar o CHECK';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set avatar_path = %L where id = %L$q$, A || '/x.gif', A)) = 'erro=23514',
    'extensão .gif deveria violar o CHECK';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set avatar_path = %L where id = %L$q$, A || '/' || repeat('a', 130) || '.png', A)) = 'erro=23514',
    'nome gigante deveria violar o CHECK';
  raise notice 'OK: CHECK aceita só <próprio-id>/<arquivo>.jpg|png|webp (sem domínio, sem URL, sem outra pasta)';

  -- colunas que o usuário NÃO pode escrever
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set avatar_url = 'https://x.example/a.png' where id = %L$q$, A)) = 'erro=42501',
    'avatar_url (antiga) não deveria ser editável';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set created_at = now() where id = %L$q$, A)) = 'erro=42501', 'created_at imutável';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set updated_at = now() where id = %L$q$, A)) = 'erro=42501', 'updated_at não editável';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set id = %L where id = %L$q$, B, A)) = 'erro=42501', 'id imutável';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set avatar_path = %L, created_at = now() where id = %L$q$, A || '/foto.png', A)) = 'erro=42501',
    'misturar avatar_path com coluna proibida deve falhar por inteiro';
  assert pg_temp.run_as('anon', null, format($q$update public.profiles set avatar_path = %L where id = %L$q$, A || '/foto.png', A)) = 'erro=42501',
    'anon não pode atualizar profiles';
  raise notice 'OK: id, created_at, updated_at e avatar_url seguem sem permissão de escrita; anon bloqueado';

  -- matriz de privilégios por coluna
  assert (select array_agg(column_name::text order by column_name) from information_schema.columns
           where table_schema = 'public' and table_name = 'profiles'
             and has_column_privilege('authenticated', 'public.profiles', column_name, 'UPDATE'))
         = array['avatar_color','avatar_emoji','avatar_path','bio','course_or_area','headline','institution','interests','location','name','user_type','username'],
    'o conjunto de colunas atualizáveis deveria ser: as 11 da migração 2 + avatar_path';
  assert not has_table_privilege('authenticated', 'public.profiles', 'DELETE') and not has_table_privilege('authenticated', 'public.profiles', 'INSERT'),
    'sem INSERT/DELETE em profiles';
  raise notice 'OK: matriz de privilégios por coluna = 11 originais + avatar_path';

  -- ===== storage.objects ========================================================
  assert pg_temp.run_as('authenticated', A, format($q$insert into storage.objects (bucket_id, name, owner) values ('avatars', %L, %L)$q$, A || '/nova.png', A)) = 'rows=1',
    'Alice deveria enviar para a PRÓPRIA pasta';
  assert pg_temp.run_as('authenticated', A, format($q$insert into storage.objects (bucket_id, name, owner) values ('avatars', %L, %L)$q$, A || '/nova.webp', A)) = 'rows=1', 'webp ok';
  raise notice 'OK: envio para a própria pasta';

  assert pg_temp.run_as('authenticated', A, format($q$insert into storage.objects (bucket_id, name, owner) values ('avatars', %L, %L)$q$, B || '/invasor.png', A)) = 'erro=42501',
    'Alice NÃO pode enviar para a pasta do Bob';
  assert pg_temp.run_as('authenticated', A, $q$insert into storage.objects (bucket_id, name) values ('avatars', 'solto.png')$q$) = 'erro=42501', 'sem arquivo na raiz do bucket';
  assert pg_temp.run_as('authenticated', A, format($q$insert into storage.objects (bucket_id, name) values ('avatars', %L)$q$, A || '/sub/x.png')) = 'erro=42501', 'sem subpastas';
  assert pg_temp.run_as('authenticated', A, format($q$insert into storage.objects (bucket_id, name) values ('avatars', %L)$q$, A || '/x.gif')) = 'erro=42501', 'extensão não permitida';
  assert pg_temp.run_as('authenticated', A, format($q$insert into storage.objects (bucket_id, name) values ('avatars', %L)$q$, A || '/x.svg')) = 'erro=42501', 'svg não permitido';
  assert pg_temp.run_as('authenticated', A, format($q$insert into storage.objects (bucket_id, name) values ('outro-bucket', %L)$q$, A || '/x.png')) in ('erro=42501','erro=23503'),
    'não vale para outros buckets';
  assert pg_temp.run_as('anon', null, format($q$insert into storage.objects (bucket_id, name) values ('avatars', %L)$q$, A || '/anon.png')) = 'erro=42501', 'anon não envia';
  raise notice 'OK: envio bloqueado fora da própria pasta, fora do padrão de nome, para anon e em outros buckets';

  assert pg_temp.run_as('authenticated', A, format($q$delete from storage.objects where bucket_id = 'avatars' and name = %L$q$, A || '/nova.png')) = 'rows=1',
    'Alice deveria apagar o PRÓPRIO arquivo';
  assert pg_temp.run_as('authenticated', A, format($q$delete from storage.objects where bucket_id = 'avatars' and name = %L$q$, B || '/bob.png')) = 'rows=0',
    'Alice NÃO pode apagar arquivo do Bob';
  assert pg_temp.run_as('anon', null, $q$delete from storage.objects where bucket_id = 'avatars'$q$) = 'rows=0', 'anon não apaga';
  assert pg_temp.run_as('authenticated', A, format($q$select 1 from storage.objects where name = %L$q$, B || '/bob.png')) = 'rows=0',
    'Alice não deveria listar via API o arquivo do Bob (a URL pública continua funcionando por ser bucket público)';
  assert pg_temp.run_as('authenticated', A, format($q$update storage.objects set name = %L where name = %L$q$, A || '/roubo.png', B || '/bob.png')) = 'rows=0',
    'sem policy de UPDATE: ninguém renomeia/move arquivo de outra pessoa';
  assert pg_temp.run_as('authenticated', A, format($q$update storage.objects set name = %L where name = %L$q$, A || '/renomeada.png', A || '/nova.webp')) = 'rows=0',
    'sem policy de UPDATE nem no próprio arquivo (o app nunca sobrescreve)';
  assert (select count(*) from storage.objects where name = B || '/bob.png') = 1, 'arquivo do Bob deveria continuar existindo';
  raise notice 'OK: exclusão só na própria pasta; sem UPDATE; sem acesso a arquivos alheios pela API';

  raise notice 'TODOS OS TESTES DE AVATAR PASSARAM';
end $$;

rollback;
