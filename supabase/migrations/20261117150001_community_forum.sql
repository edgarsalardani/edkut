-- =============================================================================
-- EdKut — Migração 15: fórum das comunidades (tópicos, comentários e respostas de 1 nível)
--
-- INCREMENTAL e NÃO DESTRUTIVA: só cria 2 tabelas, funções de gatilho, índices e políticas novas.
-- Nenhuma tabela/coluna/policy existente é alterada (communities, community_members, posts, scraps,
-- testimonials, friendships e perfis ficam como estão). Execução ÚNICA, no SQL Editor, como `postgres`,
-- depois da migração 14 (usa is_community_member, da 12, e is_community_moderator, da 4).
-- Aplique ANTES de publicar o app novo. Em caso de erro nada é aplicado (transação única).
--
-- MODELO
--   community_topics         um tópico (título + mensagem inicial) numa comunidade.
--   community_topic_replies  mensagens de um tópico: COMENTÁRIO (parent_id nulo) ou RESPOSTA a um comentário
--                            (parent_id preenchido). Um nível só: não se responde a uma resposta.
--   Contador (reply_count = comentários + respostas) e última atividade (last_activity_at) são mantidos por
--   gatilho — o cliente nunca os grava.
--
-- PERMISSÕES (decisões do pedido; valem no BANCO, não só na tela)
--   * Ler: qualquer usuário autenticado (como o restante do app).
--   * Criar tópico / comentar / responder: SOMENTE membro da comunidade (linha em community_members).
--     Quem saiu ou foi removido perde a permissão de publicar imediatamente.
--     Solicitação de entrada pendente NÃO dá permissão.
--   * Apagar: o próprio AUTOR da mensagem/tópico, ou o CRIADOR/MODERADOR da comunidade (que é moderador).
--     Apagar um tópico apaga seus comentários; apagar um comentário apaga suas respostas (ON DELETE CASCADE).
--     Quem saiu da comunidade ainda pode apagar o que ele mesmo escreveu (é conteúdo dele).
--   * NÃO existe edição: nenhum UPDATE é concedido ao cliente. Assim autor, comunidade e tópico de uma
--     publicação são imutáveis (ninguém "move" nem "reatribui" mensagens para contornar regras).
--   * O cliente só informa: (community_id, title, body) no tópico e (topic_id, parent_id, body) na mensagem.
--     author_id vem de auth.uid(); community_id da mensagem é copiado do tópico pelo gatilho; a chave
--     estrangeira composta (topic_id, community_id) impede inconsistência.
--
-- SEGURANÇA / QUALIDADE
--   * Limites: título 3–120, mensagem inicial 1–5000, comentário/resposta 1–2000 (caracteres Unicode).
--   * Texto normalizado no banco: espaços nas pontas removidos, caracteres de controle descartados.
--   * O texto é guardado como TEXTO PURO e a interface o exibe sem interpretar HTML (nenhum
--     dangerouslySetInnerHTML); "<script>" aparece como texto literal, nunca executa.
--   * Anti-abuso básico (por autor): no máx. 5 tópicos / 10 min e 15 mensagens / 1 min (erro 54000,
--     'forum_rate_limit'); mensagem idêntica repetida no mesmo tópico em 60 s é recusada (23505, 'forum_duplicate').
--   * Autor é ON DELETE SET NULL: apagar uma conta não apaga a conversa dos outros (aparece "usuário excluído").
--   * Futuro (denúncias): bastará uma tabela community_topic_reports apontando para topic_id/reply_id.
-- =============================================================================
begin;

-- ------------------------------ tópicos -----------------------------------------
create table public.community_topics (
  id               uuid primary key default gen_random_uuid(),
  community_id     uuid not null references public.communities (id) on delete cascade,
  author_id        uuid default auth.uid() references public.profiles (id) on delete set null,
  title            text not null,
  body             text not null,
  reply_count      integer not null default 0,
  last_activity_at timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  constraint community_topics_title_len check (char_length(title) between 3 and 120),
  constraint community_topics_body_len  check (char_length(body) between 1 and 5000),
  constraint community_topics_reply_count_pos check (reply_count >= 0),
  -- necessária para a FK composta das mensagens (id já é chave primária; isto só a torna referenciável em par)
  constraint community_topics_id_community_key unique (id, community_id)
);

-- Lista do fórum: atividade mais recente primeiro (paginação por faixa).
create index community_topics_activity_idx on public.community_topics (community_id, last_activity_at desc, id desc);
create index community_topics_author_idx   on public.community_topics (author_id, created_at desc);

-- ------------------------------ mensagens (comentários e respostas) -------------
create table public.community_topic_replies (
  id           uuid primary key default gen_random_uuid(),
  topic_id     uuid not null,
  community_id uuid not null,
  parent_id    uuid,
  author_id    uuid default auth.uid() references public.profiles (id) on delete set null,
  body         text not null,
  created_at   timestamptz not null default now(),
  constraint community_topic_replies_body_len check (char_length(body) between 1 and 2000),
  constraint community_topic_replies_not_self check (parent_id is null or parent_id <> id),
  -- a mensagem pertence ao tópico E à comunidade dele (não dá para apontar para outra comunidade)
  constraint community_topic_replies_topic_fk
    foreign key (topic_id, community_id) references public.community_topics (id, community_id) on delete cascade,
  constraint community_topic_replies_id_topic_key unique (id, topic_id)
);

-- A resposta pertence ao MESMO tópico do comentário original.
alter table public.community_topic_replies
  add constraint community_topic_replies_parent_fk
  foreign key (parent_id, topic_id) references public.community_topic_replies (id, topic_id) on delete cascade;

-- Comentários (raiz) em ordem cronológica; respostas por comentário; mensagens por autor (anti-abuso).
create index community_topic_comments_idx on public.community_topic_replies (topic_id, created_at, id) where parent_id is null;
create index community_topic_replies_parent_idx on public.community_topic_replies (parent_id, created_at, id) where parent_id is not null;
create index community_topic_replies_author_idx on public.community_topic_replies (author_id, created_at desc);

-- ------------------------------ gatilhos ----------------------------------------
-- Normaliza texto: descarta caracteres de controle (exceto quebra de linha e tab) e apara as pontas.
create or replace function public.forum_clean_text(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(coalesce(p_text, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g'), E' \t\r\n');
$$;

-- Tópico: normaliza, título numa linha só, limite por autor.
create or replace function public.tg_community_topics_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  new.title := regexp_replace(public.forum_clean_text(new.title), '\s+', ' ', 'g');
  new.body := public.forum_clean_text(new.body);
  new.reply_count := 0;
  new.last_activity_at := now();

  select count(*) into n
    from public.community_topics t
   where t.author_id = new.author_id and t.created_at > now() - interval '10 minutes';
  if n >= 5 then
    raise exception 'forum_rate_limit: muitos topicos em pouco tempo' using errcode = '54000';
  end if;
  return new;
end;
$$;

-- Mensagem: normaliza, copia a comunidade do tópico, valida 1 nível, limite e repetição.
create or replace function public.tg_community_topic_replies_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_community uuid;
  v_parent_parent uuid;
  v_parent_topic uuid;
  n integer;
begin
  new.body := public.forum_clean_text(new.body);

  select t.community_id into v_community from public.community_topics t where t.id = new.topic_id;
  if not found then
    raise exception 'forum_topic_not_found' using errcode = 'P0002';
  end if;
  new.community_id := v_community;   -- nunca vem do cliente

  if new.parent_id is not null then
    select p.parent_id, p.topic_id into v_parent_parent, v_parent_topic
      from public.community_topic_replies p where p.id = new.parent_id;
    if not found or v_parent_topic <> new.topic_id then
      raise exception 'forum_parent_not_found' using errcode = '23503';
    end if;
    if v_parent_parent is not null then
      raise exception 'forum_reply_depth: so e possivel responder a um comentario' using errcode = '23514';
    end if;
  end if;

  select count(*) into n
    from public.community_topic_replies r
   where r.author_id = new.author_id and r.created_at > now() - interval '1 minute';
  if n >= 15 then
    raise exception 'forum_rate_limit: muitas mensagens em pouco tempo' using errcode = '54000';
  end if;

  if exists (
    select 1 from public.community_topic_replies r
     where r.topic_id = new.topic_id and r.author_id = new.author_id
       and r.body = new.body and r.created_at > now() - interval '60 seconds'
  ) then
    raise exception 'forum_duplicate: mensagem repetida' using errcode = '23505';
  end if;
  return new;
end;
$$;

-- Contador e última atividade do tópico (atômico; refeito do zero ao apagar, para nunca "driftar").
create or replace function public.tg_community_topic_replies_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.community_topics
       set reply_count = reply_count + 1,
           last_activity_at = greatest(last_activity_at, new.created_at)
     where id = new.topic_id;
  else
    -- DELETE (inclusive em cascata): recalcula a partir do que sobrou
    update public.community_topics t
       set reply_count = (select count(*) from public.community_topic_replies r where r.topic_id = t.id),
           last_activity_at = coalesce((select max(r.created_at) from public.community_topic_replies r where r.topic_id = t.id), t.created_at)
     where t.id = old.topic_id;
  end if;
  return null;
end;
$$;

revoke all on function public.forum_clean_text(text)                         from public, anon, authenticated;
revoke all on function public.tg_community_topics_before_insert()            from public, anon, authenticated;
revoke all on function public.tg_community_topic_replies_before_insert()     from public, anon, authenticated;
revoke all on function public.tg_community_topic_replies_after()             from public, anon, authenticated;

create trigger community_topics_before_insert
  before insert on public.community_topics
  for each row execute function public.tg_community_topics_before_insert();

create trigger community_topic_replies_before_insert
  before insert on public.community_topic_replies
  for each row execute function public.tg_community_topic_replies_before_insert();

create trigger community_topic_replies_after
  after insert or delete on public.community_topic_replies
  for each row execute function public.tg_community_topic_replies_after();

-- ------------------------------ privilégios + RLS --------------------------------
alter table public.community_topics        enable row level security;
alter table public.community_topic_replies enable row level security;

revoke all on table public.community_topics        from anon, authenticated;
revoke all on table public.community_topic_replies from anon, authenticated;

grant select, delete on public.community_topics        to authenticated;
grant select, delete on public.community_topic_replies to authenticated;
-- O cliente só informa estes campos. Sem UPDATE: autor, comunidade e conteúdo são imutáveis.
grant insert (community_id, title, body) on public.community_topics        to authenticated;
grant insert (topic_id, parent_id, body)  on public.community_topic_replies to authenticated;

create policy community_topics_select on public.community_topics
  for select to authenticated using (true);
create policy community_topic_replies_select on public.community_topic_replies
  for select to authenticated using (true);

create policy community_topics_insert_member on public.community_topics
  for insert to authenticated
  with check (author_id = (select auth.uid()) and public.is_community_member(community_id));

create policy community_topic_replies_insert_member on public.community_topic_replies
  for insert to authenticated
  with check (author_id = (select auth.uid()) and public.is_community_member(community_id));

create policy community_topics_delete on public.community_topics
  for delete to authenticated
  using (author_id = (select auth.uid()) or public.is_community_moderator(community_id));

create policy community_topic_replies_delete on public.community_topic_replies
  for delete to authenticated
  using (author_id = (select auth.uid()) or public.is_community_moderator(community_id));

commit;

-- =============================================================================
-- Conferência (somente leitura) — rode depois:
--   select tablename, rowsecurity from pg_tables where schemaname='public'
--    and tablename in ('community_topics','community_topic_replies');          -- 2 linhas, rowsecurity = true
--   select tablename, policyname, cmd from pg_policies where schemaname='public'
--    and tablename in ('community_topics','community_topic_replies') order by 1, 2;   -- 3 por tabela (select, insert, delete)
--   select count(*) from public.communities;  select count(*) from public.community_members;   -- iguais aos de antes
--
-- Como desfazer (apaga TODOS os tópicos e mensagens do fórum):
--   begin;
--   drop table public.community_topic_replies;
--   drop table public.community_topics;
--   drop function public.tg_community_topic_replies_after();
--   drop function public.tg_community_topic_replies_before_insert();
--   drop function public.tg_community_topics_before_insert();
--   drop function public.forum_clean_text(text);
--   commit;
-- =============================================================================
