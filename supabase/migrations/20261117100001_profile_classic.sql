-- =============================================================================
-- EdKut — Migração 14: perfil "clássico" (status, dados pessoais, fãs, fotos, vídeos)
--
-- INCREMENTAL e NÃO DESTRUTIVA: só adiciona colunas anuláveis em `profiles`, 3 tabelas novas e 1 bucket.
-- Nenhuma tabela/coluna/policy existente é removida ou alterada (profiles_update_own continua valendo).
-- Execução ÚNICA, no SQL Editor, como `postgres`, depois das migrações 1–13. (O fórum, quando vier, usa a 15+.)
--
-- O QUE ENTRA (só o indispensável; o resto reutiliza o que já existe):
--   profiles.status_phrase     frase de status (<= 100 car.), editada pelo dono (grant por coluna)
--   profiles.relationship      relacionamento (lista fechada)
--   profiles.birthday          aniversário (o app mostra só dia e mês)
--   profiles.hobbies           texto livre (<= 300 car.)
--   profile_fans               "sou fã" (1 linha por par fã → perfil; ninguém é fã de si mesmo)
--   profile_photos + bucket `profile-photos`   fotos (o banco guarda só o CAMINHO no Storage)
--   profile_videos             vídeos do YouTube (guarda só o ID de 11 caracteres, nunca uma URL livre)
--
-- NÃO há tabela nova de avaliações: confiável/legal/sexy usam o que já existe (friend_ratings, migração 9).
-- Cidade/estado/país continuam em profiles.location; "quem sou eu" = bio; interesses = interests.
--
-- ACESSO (mesma regra de perfis e scraps): qualquer usuário AUTENTICADO vê; só o DONO cria/apaga.
-- anon não lê nada. Cotas por trigger: 100 fotos e 50 vídeos por pessoa (evita abuso de armazenamento).
-- =============================================================================
begin;

-- 1) profiles: novas colunas ----------------------------------------------------
alter table public.profiles
  add column status_phrase text,
  add column relationship  text,
  add column birthday      date,
  add column hobbies       text;

alter table public.profiles
  add constraint profiles_status_phrase_len check (status_phrase is null or char_length(btrim(status_phrase)) between 1 and 100),
  add constraint profiles_relationship_values check (relationship is null or relationship in
    ('solteiro', 'namorando', 'casado', 'uniao_estavel', 'relacionamento_aberto', 'complicado')),
  add constraint profiles_birthday_range check (birthday is null or birthday >= date '1900-01-01'),
  add constraint profiles_hobbies_len check (hobbies is null or char_length(hobbies) <= 300);

comment on column public.profiles.status_phrase is 'Frase de status exibida sob o nome (<= 100 car.). Não é a bio.';
comment on column public.profiles.birthday is 'Aniversário. O app exibe só dia e mês (o ano não é mostrado).';

-- Grant por coluna é ADITIVO: as colunas da migração 2/8 continuam como estavam.
grant update (status_phrase, relationship, birthday, hobbies) on public.profiles to authenticated;

-- 2) Fãs ------------------------------------------------------------------------
create table public.profile_fans (
  fan_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint profile_fans_pkey primary key (fan_id, profile_id),
  constraint profile_fans_not_self check (fan_id <> profile_id)
);
create index profile_fans_profile_idx on public.profile_fans (profile_id);

alter table public.profile_fans enable row level security;
revoke all on table public.profile_fans from anon, authenticated;
grant select on public.profile_fans to authenticated;
grant insert (profile_id) on public.profile_fans to authenticated;   -- fan_id vem de auth.uid() (default)
grant delete on public.profile_fans to authenticated;

create policy profile_fans_select_authenticated on public.profile_fans
  for select to authenticated using (true);
create policy profile_fans_insert_self on public.profile_fans
  for insert to authenticated with check (fan_id = (select auth.uid()));
create policy profile_fans_delete_self on public.profile_fans
  for delete to authenticated using (fan_id = (select auth.uid()));

-- 3) Fotos ----------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Envio/remoção: só autenticado, só na PRÓPRIA pasta, nome simples e extensão de imagem.
create policy profile_photos_storage_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-photos'
    and name ~ ('^' || (select auth.uid())::text || '/[A-Za-z0-9._-]+\.(jpg|png|webp)$')
  );
create policy profile_photos_storage_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy profile_photos_storage_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create table public.profile_photos (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  path       text not null,
  caption    text not null default '',
  created_at timestamptz not null default now(),
  constraint profile_photos_path_own_folder check (
    char_length(path) <= 120 and path ~ ('^' || owner_id::text || '/[A-Za-z0-9._-]+\.(jpg|png|webp)$')
  ),
  constraint profile_photos_caption_len check (char_length(caption) <= 140),
  constraint profile_photos_path_key unique (path)
);
create index profile_photos_owner_idx on public.profile_photos (owner_id, created_at desc);

alter table public.profile_photos enable row level security;
revoke all on table public.profile_photos from anon, authenticated;
grant select on public.profile_photos to authenticated;
grant insert (path, caption) on public.profile_photos to authenticated;   -- owner_id vem de auth.uid()
grant update (caption) on public.profile_photos to authenticated;
grant delete on public.profile_photos to authenticated;

create policy profile_photos_select_authenticated on public.profile_photos
  for select to authenticated using (true);
create policy profile_photos_insert_own on public.profile_photos
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy profile_photos_update_own on public.profile_photos
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy profile_photos_delete_own on public.profile_photos
  for delete to authenticated using (owner_id = (select auth.uid()));

-- 4) Vídeos (YouTube) -----------------------------------------------------------
create table public.profile_videos (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  youtube_id  text not null,
  title       text not null default '',
  description text not null default '',
  created_at  timestamptz not null default now(),
  constraint profile_videos_youtube_id_format check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  constraint profile_videos_title_len check (char_length(title) <= 100),
  constraint profile_videos_description_len check (char_length(description) <= 300),
  constraint profile_videos_owner_video_key unique (owner_id, youtube_id)
);
create index profile_videos_owner_idx on public.profile_videos (owner_id, created_at desc);

alter table public.profile_videos enable row level security;
revoke all on table public.profile_videos from anon, authenticated;
grant select on public.profile_videos to authenticated;
grant insert (youtube_id, title, description) on public.profile_videos to authenticated;
grant delete on public.profile_videos to authenticated;

create policy profile_videos_select_authenticated on public.profile_videos
  for select to authenticated using (true);
create policy profile_videos_insert_own on public.profile_videos
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy profile_videos_delete_own on public.profile_videos
  for delete to authenticated using (owner_id = (select auth.uid()));

-- 5) Cotas por pessoa -------------------------------------------------------------
create or replace function public.tg_profile_media_quota()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  n integer;
  max_items integer := tg_argv[0]::integer;
begin
  execute format('select count(*) from %I.%I where owner_id = $1', tg_table_schema, tg_table_name)
    into n using new.owner_id;
  if n >= max_items then
    raise exception 'media_quota_exceeded' using errcode = '54000';
  end if;
  return new;
end $$;

create trigger profile_photos_quota before insert on public.profile_photos
  for each row execute function public.tg_profile_media_quota(100);
create trigger profile_videos_quota before insert on public.profile_videos
  for each row execute function public.tg_profile_media_quota(50);

commit;

-- =============================================================================
-- Conferência (somente leitura) — rode depois:
--   select column_name from information_schema.columns
--    where table_schema='public' and table_name='profiles'
--      and column_name in ('status_phrase','relationship','birthday','hobbies') order by 1;   -- 4 linhas
--   select count(*) from public.profiles;                         -- igual ao de antes
--   select id, public, file_size_limit from storage.buckets where id = 'profile-photos';   -- public = true, 5242880
--   select tablename, rowsecurity from pg_tables where schemaname='public'
--    and tablename in ('profile_fans','profile_photos','profile_videos');                  -- 3 linhas, rowsecurity = true
--
-- Como desfazer (apaga fotos/vídeos/fãs cadastrados ANTES de rodar; os arquivos do bucket precisam ser apagados à parte):
--   begin;
--   drop table public.profile_videos;  drop table public.profile_photos;  drop table public.profile_fans;
--   drop function public.tg_profile_media_quota();
--   drop policy profile_photos_storage_insert_own on storage.objects;
--   drop policy profile_photos_storage_select_own on storage.objects;
--   drop policy profile_photos_storage_delete_own on storage.objects;
--   revoke update (status_phrase, relationship, birthday, hobbies) on public.profiles from authenticated;
--   alter table public.profiles drop column status_phrase, drop column relationship,
--                              drop column birthday, drop column hobbies;
--   commit;
--   (depois, no painel: Storage → apagar o bucket profile-photos)
-- =============================================================================
