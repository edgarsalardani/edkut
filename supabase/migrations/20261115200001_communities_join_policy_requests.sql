-- =============================================================================
-- EdKut — Migração 12: comunidades — tipo de entrada, solicitações de participação e permissões
--
-- INCREMENTAL e NÃO DESTRUTIVA: não apaga comunidades, membros, publicações nem comentários. Comunidades
-- e membros existentes continuam como estão; as comunidades existentes ficam como ABERTAS (comportamento
-- atual). Não toca nas migrações 1–11. Execução ÚNICA, no SQL Editor, como `postgres`, depois da 11.
-- Aplique ANTES de publicar o app novo.
--
-- REGRAS (decisões aprovadas)
--   * Tipo de entrada (communities.join_policy): 'open' = qualquer usuário autenticado entra na hora;
--     'approval' = precisa solicitar e ser aprovado. É independente da visibilidade: a comunidade continua
--     aparecendo na lista e na busca para todos os autenticados.
--   * Entrada direta (INSERT em community_members) só em comunidade ABERTA. Em comunidade com aprovação,
--     o único caminho é a solicitação aprovada (função decide_community_join_request).
--   * Solicitação pendente NÃO concede nenhuma permissão (permissão = linha em community_members).
--   * No máximo UMA solicitação pendente por usuário e comunidade (índice único parcial).
--   * Quem decide solicitações: criador e moderadores. Quem cancela: o próprio solicitante.
--   * Quem edita os dados da comunidade e o tipo de entrada: SOMENTE o criador (PD-41). Moderadores
--     passam a ter apenas: solicitações, remover participantes comuns e (migração do fórum) discussões.
--     MUDANÇA DE COMPORTAMENTO: a política antiga permitia a qualquer moderador editar a comunidade.
--   * Publicar em comunidade (posts.community_id) exige ser membro (PD-34). Nenhuma coluna/tabela é removida.
--   * Reingresso: quem saiu, foi removido, teve a solicitação recusada ou cancelada pode entrar/solicitar
--     de novo (padrão proposto; sem bloqueio permanente).
--   * Se uma comunidade com aprovação virar aberta, as solicitações pendentes continuam pendentes até
--     alguém decidir (ou o solicitante cancelar); nada é aprovado automaticamente.
--
-- O QUE MUDA
--   tipo community_join_policy; coluna communities.join_policy (padrão 'open'); privilégios por coluna
--   função is_community_member(uuid)
--   tabela community_join_requests (+ RLS: leitura do próprio solicitante e dos moderadores; sem DML direto)
--   funções request_community_join, cancel_community_join_request, decide_community_join_request
--   policy communities_update_moderators  ->  communities_update_creator
--   policy community_members_insert_self  ->  só comunidades abertas
--   policy posts_insert_own               ->  community_id exige ser membro
-- =============================================================================
begin;

-- ------------------------------ tipo de entrada --------------------------------
create type public.community_join_policy as enum ('open', 'approval');

alter table public.communities
  add column join_policy public.community_join_policy not null default 'open';

grant insert (join_policy) on public.communities to authenticated;
grant update (join_policy) on public.communities to authenticated;

-- ------------------------------ função de membro --------------------------------
create or replace function public.is_community_member(p_community uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.community_members m
     where m.community_id = p_community
       and m.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_community_member(uuid) from public, anon, authenticated;
grant execute on function public.is_community_member(uuid) to authenticated;

-- ------------------------------ solicitações ------------------------------------
create type public.community_request_status as enum ('pending', 'approved', 'declined', 'canceled');

create table public.community_join_requests (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  status       public.community_request_status not null default 'pending',
  created_at   timestamptz not null default now(),
  decided_at   timestamptz,
  decided_by   uuid references public.profiles (id) on delete set null,
  constraint community_join_requests_decided_chk
    check ((status = 'pending' and decided_at is null) or (status <> 'pending' and decided_at is not null))
);

-- Evita solicitações pendentes duplicadas (usuário x comunidade).
create unique index community_join_requests_one_pending
  on public.community_join_requests (community_id, user_id) where status = 'pending';
create index community_join_requests_pending_idx
  on public.community_join_requests (community_id, created_at) where status = 'pending';
create index community_join_requests_user_idx
  on public.community_join_requests (user_id, created_at desc);

alter table public.community_join_requests enable row level security;
revoke all on table public.community_join_requests from anon, authenticated;
grant select on public.community_join_requests to authenticated;   -- escrita: SOMENTE pelas funções abaixo

create policy community_join_requests_select on public.community_join_requests
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_community_moderator(community_id)
  );

-- Solicitar participação (comunidade com aprovação).
create or replace function public.request_community_join(p_community uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_policy public.community_join_policy;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select c.join_policy into v_policy from public.communities c where c.id = p_community;
  if not found then
    raise exception 'community_not_found' using errcode = 'P0002';
  end if;
  if v_policy <> 'approval' then
    raise exception 'community_is_open: entre diretamente' using errcode = '22023';
  end if;
  if exists (select 1 from public.community_members m where m.community_id = p_community and m.user_id = v_uid) then
    raise exception 'already_member' using errcode = '23505';
  end if;
  if exists (select 1 from public.community_join_requests r
              where r.community_id = p_community and r.user_id = v_uid and r.status = 'pending') then
    raise exception 'request_already_pending' using errcode = '23505';
  end if;

  insert into public.community_join_requests (community_id, user_id)
  values (p_community, v_uid)
  returning id into v_id;
  return v_id;
end;
$$;

-- Cancelar a própria solicitação pendente.
create or replace function public.cancel_community_join_request(p_community uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_n integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  update public.community_join_requests
     set status = 'canceled', decided_at = now()
   where community_id = p_community and user_id = v_uid and status = 'pending';
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

-- Aprovar ou recusar (criador ou moderador).
create or replace function public.decide_community_join_request(p_request uuid, p_approve boolean)
returns public.community_request_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  r public.community_join_requests%rowtype;
  v_new public.community_request_status;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into r from public.community_join_requests where id = p_request for update;
  if not found then
    raise exception 'request_not_found' using errcode = 'P0002';
  end if;
  if not public.is_community_moderator(r.community_id) then
    raise exception 'not_moderator' using errcode = '42501';
  end if;
  if r.status <> 'pending' then
    raise exception 'request_not_pending' using errcode = '55000';
  end if;

  v_new := case when p_approve then 'approved' else 'declined' end;
  if p_approve then
    insert into public.community_members (community_id, user_id, role)
    values (r.community_id, r.user_id, 'member')
    on conflict do nothing;
  end if;
  update public.community_join_requests
     set status = v_new, decided_at = now(), decided_by = v_uid
   where id = p_request;
  return v_new;
end;
$$;

revoke all on function public.request_community_join(uuid)               from public, anon, authenticated;
revoke all on function public.cancel_community_join_request(uuid)        from public, anon, authenticated;
revoke all on function public.decide_community_join_request(uuid, boolean) from public, anon, authenticated;
grant execute on function public.request_community_join(uuid)               to authenticated;
grant execute on function public.cancel_community_join_request(uuid)        to authenticated;
grant execute on function public.decide_community_join_request(uuid, boolean) to authenticated;

-- ------------------------------ políticas existentes -----------------------------
-- Editar a comunidade e o tipo de entrada: só o criador (PD-41).
drop policy communities_update_moderators on public.communities;
create policy communities_update_creator on public.communities
  for update to authenticated
  using (creator_id = (select auth.uid()))
  with check (creator_id = (select auth.uid()));

-- Entrada direta: só em comunidade aberta.
drop policy community_members_insert_self on public.community_members;
create policy community_members_insert_self on public.community_members
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and role = 'member'
    and exists (
      select 1 from public.communities c
       where c.id = community_members.community_id
         and c.join_policy = 'open'
    )
  );

-- Publicar em comunidade exige ser membro (PD-34). Publicações gerais (community_id nulo) não mudam.
alter policy posts_insert_own on public.posts
  with check (
    author_id = (select auth.uid())
    and kind in ('texto', 'projeto')
    and (community_id is null or public.is_community_member(community_id))
  );

commit;

-- =============================================================================
-- Conferência (somente leitura) — rode depois:
--   select join_policy, count(*) from public.communities group by 1;      -- esperado: tudo 'open'
--   select count(*) from public.communities;  select count(*) from public.community_members;   -- iguais aos de antes
--   select policyname from pg_policies where schemaname='public' and tablename='communities' order by 1;
--   -- esperado: communities_delete_creator, communities_insert_as_creator, communities_select_authenticated, communities_update_creator
--
-- Como desfazer (antes de usar comunidades com aprovação; apague as solicitações e volte tudo a 'open'):
--   begin;
--   update public.communities set join_policy = 'open';
--   drop function public.decide_community_join_request(uuid, boolean);
--   drop function public.cancel_community_join_request(uuid);
--   drop function public.request_community_join(uuid);
--   drop table public.community_join_requests;
--   drop type public.community_request_status;
--   alter policy posts_insert_own on public.posts
--     with check (author_id = (select auth.uid()) and kind in ('texto', 'projeto'));
--   drop policy community_members_insert_self on public.community_members;
--   create policy community_members_insert_self on public.community_members
--     for insert to authenticated with check (user_id = (select auth.uid()) and role = 'member');
--   drop policy communities_update_creator on public.communities;
--   create policy communities_update_moderators on public.communities
--     for update to authenticated using (public.is_community_moderator(id)) with check (public.is_community_moderator(id));
--   revoke insert (join_policy), update (join_policy) on public.communities from authenticated;
--   alter table public.communities drop column join_policy;
--   drop type public.community_join_policy;
--   drop function public.is_community_member(uuid);
--   commit;
-- =============================================================================
