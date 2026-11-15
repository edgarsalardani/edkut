-- =============================================================================
-- EdKut — Migração 11: respostas a scraps (conversa vinculada ao recado original)
--
-- INCREMENTAL e NÃO DESTRUTIVA: não apaga nem altera nenhum scrap existente; só ADICIONA uma coluna
-- anulável e restrições novas. Não toca nas migrações 1–10. Execução ÚNICA, no SQL Editor, como
-- `postgres`, depois da migração 10. Aplique ANTES de publicar o app novo.
--
-- REGRAS (decisão PD-30, aprovada):
--   * Scrap RAIZ (parent_id nulo): igual à migração 10 — só amigo aceito do dono do perfil; o dono não
--     escreve no próprio perfil.
--   * RESPOSTA (parent_id preenchido): pode ser enviada pelo DONO do perfil ou por AMIGO ACEITO do dono.
--     Quem não é dono nem amigo é recusado pelo banco (42501), mesmo chamando a API diretamente.
--   * A resposta pertence ao MESMO perfil do scrap original (chave estrangeira composta).
--   * Conversa de UM nível: não se responde a uma resposta (gatilho; erro 23514 "scrap_reply_depth").
--   * Apagar um scrap raiz apaga suas respostas (ON DELETE CASCADE). Apagar uma resposta: autor da
--     resposta ou dono do perfil (política de DELETE existente, inalterada).
--   * Leitura inalterada (scraps_select_authenticated).
--   * Notificações: gatilho tg_notify_scrap INALTERADO. Resposta de amigo avisa o dono (kind 'scrap');
--     resposta do dono não gera aviso (novos tipos de notificação ficam para uma migração opcional, PD-35).
--
-- O QUE MUDA
--   scraps.parent_id (nova, anulável) + índices + unique (id, profile_owner_id) + FK composta
--   gatilho scraps_reply_depth (BEFORE INSERT)
--   scraps_insert_own (policy) — agora distingue raiz de resposta
--   grant insert (parent_id) para authenticated
-- =============================================================================
begin;

alter table public.scraps add column parent_id uuid;

-- Necessária para a FK composta (id já é chave primária; isto só a torna referenciável em par).
alter table public.scraps add constraint scraps_id_owner_key unique (id, profile_owner_id);

alter table public.scraps
  add constraint scraps_parent_same_profile_fk
  foreign key (parent_id, profile_owner_id)
  references public.scraps (id, profile_owner_id)
  on delete cascade;

alter table public.scraps
  add constraint scraps_parent_not_self check (parent_id is null or parent_id <> id);

create index scraps_parent_idx on public.scraps (parent_id, created_at) where parent_id is not null;

-- Uma resposta só pode apontar para um scrap raiz.
create or replace function public.tg_scraps_reply_depth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_id is not null
     and exists (select 1 from public.scraps p where p.id = new.parent_id and p.parent_id is not null) then
    raise exception 'scrap_reply_depth: so e possivel responder a um scrap raiz'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.tg_scraps_reply_depth() from public, anon, authenticated;

create trigger scraps_reply_depth
  before insert on public.scraps
  for each row execute function public.tg_scraps_reply_depth();

-- Privilégio por coluna: o cliente passa a poder informar parent_id (author_id continua vindo de auth.uid()).
grant insert (parent_id) on public.scraps to authenticated;

alter policy scraps_insert_own on public.scraps
  with check (
    author_id = (select auth.uid())
    and (
      -- scrap raiz: regra da migração 10
      (parent_id is null
        and profile_owner_id <> author_id
        and public.are_friends(author_id, profile_owner_id))
      or
      -- resposta: dono do perfil ou amigo aceito do dono
      (parent_id is not null
        and (author_id = profile_owner_id
             or public.are_friends(author_id, profile_owner_id)))
    )
  );

commit;

-- =============================================================================
-- Conferência (somente leitura) — rode depois:
--   select column_name, is_nullable from information_schema.columns
--    where table_schema = 'public' and table_name = 'scraps' order by ordinal_position;
--   -- esperado: ... parent_id | YES
--   select policyname, cmd from pg_policies where schemaname='public' and tablename='scraps' order by 1;
--   -- esperado: scraps_delete_author_or_owner, scraps_insert_own, scraps_select_authenticated
--   select count(*) as scraps_total, count(parent_id) as respostas from public.scraps;
--   -- esperado: respostas = 0 logo após a migração (nenhum scrap existente foi alterado)
--
-- Como desfazer (só antes de existirem respostas; se já houver respostas, apague-as primeiro:
--   delete from public.scraps where parent_id is not null;):
--   begin;
--   drop trigger scraps_reply_depth on public.scraps;
--   drop function public.tg_scraps_reply_depth();
--   alter policy scraps_insert_own on public.scraps
--     with check (author_id = (select auth.uid()) and profile_owner_id <> author_id
--                 and public.are_friends(author_id, profile_owner_id));
--   revoke insert (parent_id) on public.scraps from authenticated;
--   alter table public.scraps drop constraint scraps_parent_not_self;
--   alter table public.scraps drop constraint scraps_parent_same_profile_fk;
--   drop index public.scraps_parent_idx;
--   alter table public.scraps drop column parent_id;
--   alter table public.scraps drop constraint scraps_id_owner_key;
--   commit;
-- =============================================================================
