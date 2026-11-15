-- =============================================================================
-- EdKut — Migração 13: imagem da comunidade (Storage + coluna image_path)
--
-- INCREMENTAL e NÃO DESTRUTIVA: só adiciona uma coluna anulável, um bucket e policies de Storage.
-- Execução ÚNICA, no SQL Editor, como `postgres`, depois da migração 12.
--
-- A imagem CONVIVE com o emoji e a cor atuais (PD-39): comunidades sem imagem continuam como estão.
-- Bucket público (leitura por URL, como o de fotos de perfil), limite de 2 MB, JPEG/PNG/WebP.
-- Só o CRIADOR da comunidade grava/apaga arquivos na pasta "<id da comunidade>/".
-- O banco guarda apenas o CAMINHO ("<id>/<arquivo>.<ext>"); a URL é montada pelo app.
-- =============================================================================
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-images', 'community-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy community_images_insert_creator on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'community-images'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]+\.(jpg|png|webp)$'
    and exists (
      select 1 from public.communities c
       where c.id::text = (storage.foldername(objects.name))[1]
         and c.creator_id = (select auth.uid())
    )
  );

create policy community_images_select_creator on storage.objects
  for select to authenticated
  using (
    bucket_id = 'community-images'
    and exists (
      select 1 from public.communities c
       where c.id::text = (storage.foldername(objects.name))[1]
         and c.creator_id = (select auth.uid())
    )
  );

create policy community_images_delete_creator on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'community-images'
    and exists (
      select 1 from public.communities c
       where c.id::text = (storage.foldername(objects.name))[1]
         and c.creator_id = (select auth.uid())
    )
  );

alter table public.communities add column image_path text;

alter table public.communities
  add constraint communities_image_path_own_folder
  check (
    image_path is null
    or (
      char_length(image_path) <= 120
      and image_path ~ ('^' || id::text || '/[A-Za-z0-9._-]+\.(jpg|png|webp)$')
    )
  );

comment on column public.communities.image_path is
  'Caminho da imagem no bucket community-images: <id da comunidade>/<arquivo>.<jpg|png|webp>. A URL é montada pelo app.';

-- A imagem é definida depois da criação (precisa do id); a edição já é só do criador (policy da migração 12).
grant update (image_path) on public.communities to authenticated;

commit;

-- =============================================================================
-- Conferência (somente leitura):
--   select id, public, file_size_limit from storage.buckets where id = 'community-images';
--   select policyname from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'community_images%';
--   -- esperado: 3 policies (insert, select, delete)
--
-- NOTA: dentro do EXISTS, "name" seria a coluna communities.name; por isso as policies usam objects.name.
--
-- Como desfazer (apague antes os arquivos do bucket pelo painel, se houver):
--   begin;
--   drop policy community_images_insert_creator on storage.objects;
--   drop policy community_images_select_creator on storage.objects;
--   drop policy community_images_delete_creator on storage.objects;
--   revoke update (image_path) on public.communities from authenticated;
--   alter table public.communities drop constraint communities_image_path_own_folder;
--   alter table public.communities drop column image_path;
--   delete from storage.buckets where id = 'community-images';
--   commit;
-- =============================================================================
