-- =============================================================================
-- EdKut — Migração 9: avaliações sociais NERD · PARCEIRO · TECH feitas pelos amigos
--
-- INCREMENTAL: não altera nenhuma das migrações 1–8. Execução ÚNICA, no SQL Editor, como
-- `postgres`, depois das migrações 1–8. Tudo numa transação (se algo falhar, nada é aplicado).
-- Sem DROP/TRUNCATE/DELETE de dados.
--
-- POR QUE UMA TABELA NOVA: `social_ratings` (migração 6) guarda notas de 1 a 5, IMUTÁVEIS, sem
-- data de atualização, e alimenta contadores em `profile_scores`. Os requisitos agora são notas
-- de 0 a 100, EDITÁVEIS, média calculada na leitura e votos de amizades desfeitas fora da conta.
-- Isso exigiria apagar/alterar constraints, grants e triggers daquela tabela. Em vez disso,
-- `social_ratings`, `profile_scores` (incl. `geek_base`) e `social_score_pct()` ficam INTACTOS
-- e passam a ficar sem uso pelo app (limpeza opcional futura; ver docs).
--
-- MODELO
--   friend_ratings (rater_id, rated_id) — 1 linha por par avaliador→avaliado, com os 3 valores (0–100),
--   created_at e updated_at. Nenhum percentual consolidado é guardado: a média é calculada na
--   leitura por profile_social_scores().
--
-- REGRA DE VALIDADE DO VOTO (única, usada na média e em my_friend_rating):
--   um voto conta se EXISTE amizade atual entre os dois E o voto foi gravado/confirmado
--   DEPOIS do início dessa amizade (friend_ratings.updated_at >= friendships.created_at).
--   => amizade desfeita: o voto deixa de contar (a linha friendships some);
--   => amizade restabelecida: nasce uma linha nova em friendships (created_at novo), então os
--      votos antigos continuam FORA até o avaliador salvar de novo (nova avaliação explícita).
--
-- SEGURANÇA (no banco, não só no front-end)
--   * RLS: só autenticados; o avaliador só LÊ os próprios votos (ninguém vê quem votou em quem);
--     INSERT/UPDATE só como si mesmo E se are_friends(rater, rated); não há DELETE para o cliente;
--   * grants por coluna: o cliente só informa rated_id e os 3 valores (rater_id vem de auth.uid();
--     created_at/updated_at são controlados pelo banco);
--   * CHECKs: não é possível avaliar a si mesmo, valores fora de 0–100 nem duplicar o par (PK);
--   * a média só existe via função SECURITY DEFINER (somente leitura, EXECUTE só p/ authenticated);
--     não há coluna de média para alterar.
-- =============================================================================
begin;

create table public.friend_ratings (
  rater_id   uuid        not null default auth.uid() references public.profiles (id) on delete cascade,
  rated_id   uuid        not null references public.profiles (id) on delete cascade,
  nerd       smallint    not null,
  parceiro   smallint    not null,
  tech       smallint    not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friend_ratings_pkey           primary key (rater_id, rated_id),
  constraint friend_ratings_not_self       check (rater_id <> rated_id),
  constraint friend_ratings_nerd_range     check (nerd     between 0 and 100),
  constraint friend_ratings_parceiro_range check (parceiro between 0 and 100),
  constraint friend_ratings_tech_range     check (tech     between 0 and 100)
);

comment on table public.friend_ratings is
  'Avaliação NERD/PARCEIRO/TECH (0–100) de um amigo sobre outro. Uma linha por par; editável; média só via profile_social_scores().';

create index friend_ratings_rated_idx on public.friend_ratings (rated_id);

-- updated_at confiável (o cliente não tem permissão de escrever nessa coluna).
create trigger friend_ratings_set_updated_at
  before update on public.friend_ratings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Privilégios + RLS
-- -----------------------------------------------------------------------------
alter table public.friend_ratings enable row level security;
revoke all on table public.friend_ratings from anon, authenticated;

grant select on public.friend_ratings to authenticated;
grant insert (rated_id, nerd, parceiro, tech) on public.friend_ratings to authenticated;  -- rater_id = auth.uid() (default)
grant update (nerd, parceiro, tech) on public.friend_ratings to authenticated;
-- sem DELETE para o cliente (a linha some em cascata se uma das contas for apagada)

-- Cada pessoa enxerga somente os PRÓPRIOS votos. O agregado sai pela função abaixo.
create policy friend_ratings_select_own on public.friend_ratings
  for select to authenticated
  using (rater_id = (select auth.uid()));

-- Votar: como si mesmo e apenas em quem é amigo AGORA.
create policy friend_ratings_insert_friends on public.friend_ratings
  for insert to authenticated
  with check (
    rater_id = (select auth.uid())
    and rater_id <> rated_id
    and public.are_friends(rater_id, rated_id)
  );

-- Alterar: só o próprio voto, e só enquanto forem amigos.
create policy friend_ratings_update_own_friends on public.friend_ratings
  for update to authenticated
  using (
    rater_id = (select auth.uid())
    and public.are_friends(rater_id, rated_id)
  )
  with check (
    rater_id = (select auth.uid())
    and public.are_friends(rater_id, rated_id)
  );

-- -----------------------------------------------------------------------------
-- Funções
-- -----------------------------------------------------------------------------

-- Percentuais consolidados de um perfil: média aritmética (peso igual por amigo) dos votos VÁLIDOS,
-- arredondada ao inteiro (.5 sobe). Sem votos válidos => 0, 0, 0 e ratings_count = 0.
-- SECURITY DEFINER para somar votos que o chamador não pode ler individualmente; só leitura.
create or replace function public.profile_social_scores(p_profile uuid)
returns table (nerd smallint, parceiro smallint, tech smallint, ratings_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(round(avg(r.nerd))::smallint,     0::smallint),
         coalesce(round(avg(r.parceiro))::smallint, 0::smallint),
         coalesce(round(avg(r.tech))::smallint,     0::smallint),
         count(*)::integer
    from public.friend_ratings r
    join public.friendships f
      on f.user_a = least(r.rater_id, r.rated_id)
     and f.user_b = greatest(r.rater_id, r.rated_id)
   where r.rated_id = p_profile
     and r.updated_at >= f.created_at;
$$;

-- O voto do próprio usuário sobre alguém, com a indicação de que ele está sendo contado agora
-- (is_current = false: amizade desfeita ou refeita depois do voto => precisa salvar de novo).
-- SECURITY INVOKER: a RLS garante que só o próprio voto é visível.
create or replace function public.my_friend_rating(p_rated uuid)
returns table (nerd smallint, parceiro smallint, tech smallint, updated_at timestamptz, is_current boolean)
language sql
stable
set search_path = ''
as $$
  select r.nerd, r.parceiro, r.tech, r.updated_at,
         exists (
           select 1
             from public.friendships f
            where f.user_a = least(r.rater_id, r.rated_id)
              and f.user_b = greatest(r.rater_id, r.rated_id)
              and r.updated_at >= f.created_at
         )
    from public.friend_ratings r
   where r.rater_id = (select auth.uid())
     and r.rated_id = p_rated;
$$;

-- Registra OU substitui a avaliação (upsert atômico: sem duplicar, sem corrida).
-- SECURITY INVOKER: as policies acima continuam valendo; as checagens abaixo só dão mensagens claras.
create or replace function public.rate_friend(p_rated uuid, p_nerd integer, p_parceiro integer, p_tech integer)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_rated is null or p_rated = v_uid then
    raise exception 'cannot rate yourself' using errcode = '22023';
  end if;
  if p_nerd is null or p_parceiro is null or p_tech is null
     or p_nerd not between 0 and 100 or p_parceiro not between 0 and 100 or p_tech not between 0 and 100 then
    raise exception 'rating out of range (0-100)' using errcode = '22003';
  end if;
  if not public.are_friends(v_uid, p_rated) then
    raise exception 'only friends can rate' using errcode = '42501';
  end if;

  insert into public.friend_ratings (rated_id, nerd, parceiro, tech)
  values (p_rated, p_nerd::smallint, p_parceiro::smallint, p_tech::smallint)
  on conflict (rater_id, rated_id) do update
    set nerd     = excluded.nerd,
        parceiro = excluded.parceiro,
        tech     = excluded.tech;
end;
$$;

revoke all on function public.profile_social_scores(uuid)              from public, anon, authenticated;
revoke all on function public.my_friend_rating(uuid)                   from public, anon, authenticated;
revoke all on function public.rate_friend(uuid, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.profile_social_scores(uuid)              to authenticated;
grant execute on function public.my_friend_rating(uuid)                   to authenticated;
grant execute on function public.rate_friend(uuid, integer, integer, integer) to authenticated;

commit;

-- =============================================================================
-- Conferência (somente leitura) — rode depois:
--   select column_name, data_type from information_schema.columns
--    where table_schema = 'public' and table_name = 'friend_ratings' order by ordinal_position;
--   -- esperado: rater_id, rated_id, nerd, parceiro, tech, created_at, updated_at
--
--   select conname from pg_constraint where conrelid = 'public.friend_ratings'::regclass order by 1;
--   -- esperado: friend_ratings_nerd_range, _not_self, _parceiro_range, _pkey, _tech_range e as 2 FKs
--
--   select policyname, cmd from pg_policies
--    where schemaname = 'public' and tablename = 'friend_ratings' order by 1;
--   -- esperado: friend_ratings_insert_friends INSERT · friend_ratings_select_own SELECT ·
--   --           friend_ratings_update_own_friends UPDATE
--
--   select proname, prosecdef as security_definer from pg_proc
--    where pronamespace = 'public'::regnamespace
--      and proname in ('profile_social_scores', 'my_friend_rating', 'rate_friend') order by 1;
--   -- esperado: my_friend_rating f · profile_social_scores t · rate_friend f
--
-- Como desfazer (só se precisar; apaga os votos registrados):
--   begin;
--   drop function public.rate_friend(uuid, integer, integer, integer);
--   drop function public.my_friend_rating(uuid);
--   drop function public.profile_social_scores(uuid);
--   drop table public.friend_ratings;
--   commit;
-- =============================================================================
