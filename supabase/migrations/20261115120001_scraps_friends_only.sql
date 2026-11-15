-- =============================================================================
-- EdKut — Migração 10: scraps (recados) somente entre AMIGOS (regra no banco)
--
-- INCREMENTAL e NÃO DESTRUTIVA: não recria tabelas, não apaga nem altera nenhum scrap existente,
-- não toca nas migrações 1–9. Execução ÚNICA, no SQL Editor, como `postgres`, depois da migração 9.
--
-- POR QUE É NECESSÁRIA: a policy atual `scraps_insert_own` (migração 6) só exige
-- `author_id = auth.uid()` — qualquer usuário logado podia escrever no perfil de qualquer pessoa.
-- Regra de negócio nova: só quem tem AMIZADE ACEITA com o dono do perfil pode enviar scraps.
-- (É a versão "só amigos" da decisão D2; difere do arquivo opcional D2_scraps_friends_only.sql em
--  um ponto: aquele também liberava o scrap no PRÓPRIO perfil. Aqui NÃO: scrap é entre duas pessoas.)
--
-- O QUE MUDA
--   scraps_insert_own  (INSERT): author = auth.uid()  E  dono do perfil <> autor  E  are_friends(autor, dono).
--
-- O QUE NÃO MUDA
--   * leitura (scraps_select_authenticated): scraps continuam públicos dentro da rede;
--   * apagar (scraps_delete_author_or_owner): autor e dono do perfil continuam podendo apagar;
--   * scraps antigos continuam existindo e visíveis, mesmo que a amizade termine depois
--     (a regra vale no momento de ENVIAR; não apaga histórico);
--   * grants por coluna (cliente só informa profile_owner_id e body; author_id vem de auth.uid()).
--
-- ORDEM: aplique esta migração ANTES (ou junto) de publicar o app novo. Se o app novo subir antes,
-- a interface já só oferece o formulário a amigos, mas o banco ainda aceitaria scrap de não-amigo
-- até esta migração ser executada.
-- =============================================================================
begin;

alter policy scraps_insert_own on public.scraps
  with check (
    author_id = (select auth.uid())
    and profile_owner_id <> author_id
    and public.are_friends(author_id, profile_owner_id)
  );

commit;

-- =============================================================================
-- Conferência (somente leitura) — rode depois:
--   select policyname, cmd, with_check from pg_policies
--    where schemaname = 'public' and tablename = 'scraps' order by 1;
--   -- esperado: scraps_insert_own INSERT com "are_friends" e "profile_owner_id <> author_id" no with_check;
--   --           scraps_select_authenticated SELECT; scraps_delete_author_or_owner DELETE
--
-- Como desfazer (volta ao comportamento anterior: qualquer usuário logado escreve em qualquer perfil):
--   alter policy scraps_insert_own on public.scraps
--     with check (author_id = (select auth.uid()));
-- =============================================================================
