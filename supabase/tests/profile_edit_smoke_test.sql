-- =============================================================================
-- EdKut — Teste de fumaça da EDIÇÃO DE PERFIL (RLS, constraints, username único)
--
-- Não exige migração nova: usa as policies/grants/constraints das migrações 2 e 8.
-- Rode SOMENTE em projeto de DESENVOLVIMENTO, no SQL Editor, o arquivo inteiro de uma vez.
-- Cria 2 usuários de teste e termina em ROLLBACK. Esperado: "OK: ..." e, no fim,
-- "TODOS OS TESTES DE EDIÇÃO DE PERFIL PASSARAM".
-- A corrida entre dois cadastros/edições simultâneos com o mesmo username é resolvida pelo
-- índice único profiles_username_key (o segundo recebe SQLSTATE 23505), não por checagem no app.
-- =============================================================================
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice-edit@edkut.test', '{"username":"alice.edit"}'::jsonb),
  ('00000000-0000-0000-0000-0000000000b2', 'bob-edit@edkut.test',   '{"username":"bob.edit"}'::jsonb);

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
  -- edição normal de todos os campos editáveis
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set
      name = 'Alice Editada', username = 'alice.nova', user_type = 'professor', headline = 'Prof. de IHC',
      bio = 'Gosto de usabilidade.', institution = 'UFES', course_or_area = 'Informática', location = 'Vitória, ES',
      interests = array['IHC','Avaliação Heurística'], avatar_emoji = '🧑‍🏫', avatar_color = '#1D4E89'
    where id = %L$q$, A)) = 'rows=1', 'Alice deveria editar o próprio perfil';
  assert (select name || '|' || username || '|' || bio from public.profiles where id = A::uuid) = 'Alice Editada|alice.nova|Gosto de usabilidade.', 'dados persistidos';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set institution = null, course_or_area = null, location = null, interests = '{}' where id = %L$q$, A)) = 'rows=1', 'campos opcionais podem voltar a vazio';
  raise notice 'OK: o próprio usuário edita nome, username, tipo, frase, bio, instituição, curso, local, interesses e avatar padrão';

  -- username duplicado
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set username = 'bob.edit' where id = %L$q$, A)) = 'erro=23505', 'username já usado deve ser rejeitado (23505)';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set username = 'alice.nova' where id = %L$q$, A)) = 'rows=1', 'manter o próprio username não é conflito';
  raise notice 'OK: username duplicado é rejeitado pelo banco (unique), mesmo se o app não checar';

  -- formatos/limites (CHECKs)
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set username = 'Alice Nova' where id = %L$q$, A)) = 'erro=23514', 'username com maiúscula/espaço';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set username = 'ab' where id = %L$q$, A)) = 'erro=23514', 'username curto';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set name = 'A' where id = %L$q$, A)) = 'erro=23514', 'nome curto';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set bio = %L where id = %L$q$, repeat('x', 501), A)) = 'erro=23514', 'bio > 500';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set headline = %L where id = %L$q$, repeat('x', 121), A)) = 'erro=23514', 'headline > 120';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set location = %L where id = %L$q$, repeat('x', 121), A)) = 'erro=23514', 'localização > 120';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set interests = (select array_agg('i' || g) from generate_series(1, 21) g) where id = %L$q$, A)) = 'erro=23514', 'mais de 20 interesses';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set avatar_color = 'azul' where id = %L$q$, A)) = 'erro=23514', 'cor inválida';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set user_type = 'hacker' where id = %L$q$, A)) = 'erro=22P02', 'tipo inválido (enum)';
  raise notice 'OK: formatos e limites validados no banco';

  -- perfil de outra pessoa e campos protegidos
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set name = 'Invadido', bio = 'x' where id = %L$q$, B)) = 'rows=0', 'Alice NÃO edita o perfil do Bob';
  assert (select name from public.profiles where id = B::uuid) <> 'Invadido', 'perfil do Bob intacto';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set id = %L where id = %L$q$, B, A)) = 'erro=42501', 'id protegido';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set created_at = now() where id = %L$q$, A)) = 'erro=42501', 'created_at protegido';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set updated_at = now() where id = %L$q$, A)) = 'erro=42501', 'updated_at protegido';
  assert pg_temp.run_as('authenticated', A, format($q$update public.profiles set avatar_url = 'https://x.example/a.png' where id = %L$q$, A)) = 'erro=42501', 'avatar_url (legado) protegido';
  assert pg_temp.run_as('authenticated', A, $q$update auth.users set email = 'x@x.test'$q$) = 'erro=42501', 'e-mail (auth.users) fora do alcance do cliente';
  assert pg_temp.run_as('anon', null, format($q$update public.profiles set name = 'Anon' where id = %L$q$, A)) = 'erro=42501', 'anon não edita';
  raise notice 'OK: só o dono edita; id/created_at/updated_at/avatar_url protegidos; e-mail e senha fora do alcance';

  raise notice 'TODOS OS TESTES DE EDIÇÃO DE PERFIL PASSARAM';
end $$;

rollback;
