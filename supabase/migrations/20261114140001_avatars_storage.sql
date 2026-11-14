-- =============================================================================
-- EdKut — Migração 8: foto de perfil (Supabase Storage)            [REVISADA]
--
-- INCREMENTAL e SEPARADA das sete migrações originais (nenhuma delas é alterada).
-- Execução ÚNICA, no SQL Editor, como `postgres`, depois das migrações 1–7.
-- Tudo está dentro de uma transação: se qualquer comando falhar, NADA é aplicado.
-- Não contém DROP, TRUNCATE nem DELETE de dados.
--
-- Decisão de segurança (revisão): o perfil guarda apenas o CAMINHO RELATIVO da foto
-- (`profiles.avatar_path` = '<id-do-usuário>/<arquivo>.<ext>'), nunca uma URL. O endereço
-- completo é montado pelo app a partir do domínio do PRÓPRIO projeto (supabase.storage
-- .getPublicUrl). Assim não existe como apontar o avatar para domínio externo, e a
-- constraint não precisa conhecer (nem confiar em) nenhum domínio. A coluna antiga
-- `avatar_url` (migração 2) fica sem uso, sem permissão de escrita e sempre NULL.
--
-- O que esta migração faz:
--  1) cria o bucket público `avatars`: 2 MB, apenas JPEG/PNG/WebP (impostos pelo servidor
--     do Storage). Leitura pública por URL; escrita só pelo dono (item 2);
--  2) policies em storage.objects: cada usuário só ENVIA, LÊ e APAGA arquivos dentro da
--     pasta com o PRÓPRIO id. Sem policy de UPDATE (o app nunca sobrescreve: nome novo a cada foto);
--  3) adiciona profiles.avatar_path com CHECK (só aceita a pasta do próprio usuário) e libera
--     UPDATE somente nessa coluna. A policy existente `profiles_update_own` continua limitando
--     a escrita à própria linha; as demais colunas seguem exatamente como na migração 2.
-- =============================================================================
begin;

-- 1) Bucket --------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2) Policies em storage.objects ------------------------------------------------
-- Envio: só autenticado, só na própria pasta, nome simples (sem subpastas) e extensão de imagem.
create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and name ~ ('^' || (select auth.uid())::text || '/[A-Za-z0-9._-]+\.(jpg|png|webp)$')
  );

-- Leitura pelo dono via API (a leitura pública das imagens por URL não depende desta policy).
create policy avatars_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Remoção: só o dono apaga arquivos da própria pasta (o app apaga a foto anterior).
create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- 3) profiles.avatar_path -------------------------------------------------------
alter table public.profiles add column avatar_path text;

alter table public.profiles
  add constraint profiles_avatar_path_own_folder
  check (
    avatar_path is null
    or (
      char_length(avatar_path) <= 120
      and avatar_path ~ ('^' || id::text || '/[A-Za-z0-9._-]+\.(jpg|png|webp)$')
    )
  );

comment on column public.profiles.avatar_path is
  'Caminho da foto no bucket avatars: <id>/<arquivo>.<jpg|png|webp>. A URL é montada pelo app.';
comment on column public.profiles.avatar_url is
  'SEM USO (substituída por avatar_path). Não editável pelo cliente; mantida só por compatibilidade.';

-- Só esta coluna é liberada (grant por coluna é ADITIVO: não afeta as 11 colunas da migração 2,
-- e id, created_at, updated_at e avatar_url continuam sem permissão de escrita).
-- SELECT já cobre a tabela inteira (migração 2), então a nova coluna é legível sem novo grant.
grant update (avatar_path) on public.profiles to authenticated;

commit;

-- =============================================================================
-- Conferência (somente leitura) — rode depois:
--   select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'avatars';
--   -- esperado: 1 linha; public = true; 2097152; {image/jpeg,image/png,image/webp}
--
--   select policyname, cmd from pg_policies
--    where schemaname = 'storage' and tablename = 'objects' and policyname like 'avatars_%' order by 1;
--   -- esperado: avatars_delete_own DELETE · avatars_insert_own INSERT · avatars_select_own SELECT
--
--   select column_name,
--          has_column_privilege('authenticated', 'public.profiles', column_name, 'UPDATE') as pode_atualizar
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'profiles' order by ordinal_position;
--   -- esperado TRUE: name, username, user_type, headline, bio, institution, course_or_area,
--   --                location, interests, avatar_emoji, avatar_color, avatar_path
--   -- esperado FALSE: id, avatar_url, created_at, updated_at
--
-- Como desfazer (só se precisar):
--   begin;
--   revoke update (avatar_path) on public.profiles from authenticated;
--   alter table public.profiles drop constraint profiles_avatar_path_own_folder;
--   alter table public.profiles drop column avatar_path;
--   drop policy avatars_insert_own on storage.objects;
--   drop policy avatars_select_own on storage.objects;
--   drop policy avatars_delete_own on storage.objects;
--   commit;
--   -- O bucket e os arquivos enviados devem ser removidos pelo painel Storage (ou API); o Supabase
--   -- não permite apagar arquivos por SQL direto em storage.objects.
-- =============================================================================
