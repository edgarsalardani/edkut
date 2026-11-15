# EdKut — Entrega 2: comunidades completas

O que esta entrega faz: criar comunidade (nome, descrição, categoria, imagem), entrada **aberta** ou **mediante aprovação**, entrar/sair, solicitar/cancelar participação, aprovar/recusar (criador e moderadores), lista de participantes, moderadores (definidos pelo criador), remoção de participantes, edição pelo criador, busca/filtro/abas na lista de comunidades.
Fóruns **não** estão nesta entrega (Entrega 3). A documentação LaTeX não foi alterada.

## 1. Antes de tudo
- Faça backup/branch do projeto. Se possível, aplique primeiro em um projeto Supabase de **desenvolvimento**.
- Esta entrega vem **depois** da Entrega 1 (migration 11 já aplicada). O arquivo `src/types/index.ts` é cumulativo (inclui os tipos da Entrega 1).

## 2. Copiar arquivos (mesmos caminhos, na raiz do projeto)
Novos ou substituídos:
- `src/types/index.ts` (substitui)
- `src/lib/communities.ts` (novo)
- `src/services/communityService.ts` (**substitui** a versão antiga baseada em dados de exemplo)
- `src/components/CommunityImageField.tsx`, `CommunityFields.tsx`, `CommunityCard.tsx`, `CommunityPageClient.tsx` (novos)
- `src/components/CommunitiesPageClient.tsx` (substitui)
- `src/app/communities/page.tsx` (substitui) e `src/app/communities/[id]/page.tsx` (novo)
- `supabase/migrations/20261115200001_communities_join_policy_requests.sql` e `20261115200002_communities_image.sql`
- `supabase/tests/communities_smoke_test.sql` (opcional)

**Apague** `src/components/CommunityHeader.tsx` (não é mais usado). `CommunityGrid.tsx`, os dados de exemplo e `searchService` não foram alterados. Se algum outro arquivo seu importava funções do antigo `communityService.ts`, ajuste-o (no projeto que recebi, nenhum importava).

## 3. Aplicar as migrations (SQL Editor, como `postgres`) — ANTES de publicar o app
Cada arquivo roda uma vez, em uma transação, **nesta ordem**:
1. `20261115200001_communities_join_policy_requests.sql`
2. `20261115200002_communities_image.sql`

Conferência (somente leitura), após a 1ª:
```sql
select join_policy, count(*) from public.communities group by 1;   -- tudo 'open'
select count(*) from public.communities;  select count(*) from public.community_members;  -- iguais aos de antes
select policyname from pg_policies where schemaname='public' and tablename='communities' order by 1;
-- esperado: communities_delete_creator, communities_insert_as_creator, communities_select_authenticated, communities_update_creator
```
Após a 2ª:
```sql
select id, public, file_size_limit from storage.buckets where id = 'community-images';  -- public = true, 2097152
select column_name from information_schema.columns where table_name='communities' and column_name in ('join_policy','image_path');
```
Nenhuma tabela/coluna existente é removida; comunidades e membros atuais viram `entrada aberta`. Instruções de desfazer estão no fim de cada arquivo.

## 4. Rodar
`npm run dev` (ou build). Sem as migrations a tela de comunidades mostra um aviso pedindo para aplicá-las, em vez de quebrar.

## 5. Teste manual sugerido (use 2 contas, de preferência 3)
1. Conta A: `/communities` → "criar comunidade" com nome, descrição, categoria, **imagem** e entrada **mediante aprovação** → abre a página da comunidade (A é criador e moderador).
2. Conta B: busque a comunidade → "solicitar participação" → aparece "solicitação enviada". Teste "cancelar solicitação" e solicite de novo.
3. Conta A: aba **administração** → aprovar B. B vira membro (participantes, contador). Teste também **recusar** com outra solicitação.
4. A: em participantes, "tornar moderador" para B; B vê a aba administração, decide solicitações e remove participantes comuns, mas **não** edita dados nem remove outro moderador.
5. A: editar nome/descrição/imagem/tipo de entrada (só o criador vê o formulário). Mudar para "aberta": quem não é membro passa a ver "entrar na comunidade".
6. B sai da comunidade ("sair" com confirmação); o criador não vê o botão de sair.
7. Conta C (não membro): não consegue postar na comunidade (o banco bloqueia) e não vê o painel de solicitações.
8. Opcional: `supabase/tests/communities_smoke_test.sql` no SQL Editor de **desenvolvimento** (termina em ROLLBACK, não deixa dados) — deve terminar com `TODOS OS TESTES PASSARAM`.

## 6. Decisões aplicadas
- Só o **criador** edita dados e tipo de entrada. **Mudança de comportamento:** moderadores existentes perdem o direito de editar a comunidade (antes podiam). Moderadores gerenciam solicitações e removem participantes comuns.
- Pedidos pendentes continuam pendentes se a comunidade passar para "aberta" (o painel avisa).
- Quem saiu, foi removido, recusado ou cancelou pode solicitar/entrar de novo.
- Postagens em comunidade exigem ser membro; posts antigos de não membros **foram preservados** (nada é apagado).
- Imagem JPEG/PNG/WebP até 2 MB; sem imagem, usa emoji/cor. Sem notificações novas nesta entrega.

## 7. NÃO verificado / fora do escopo
- `npm run build` e lint **não rodaram** (sem rede para instalar dependências aqui): só type-check com stubs.
- Migrations e testes SQL rodaram em PostgreSQL 16 local com emulação do Supabase (sem Auth, PostgREST e Storage reais). A interface foi testada em Chromium com Supabase simulado e **sem Tailwind compilado** (o visual/layout real não foi avaliado). Nada foi testado no seu Supabase nem com contas reais.
- Cenários com terceira conta (moderador/não amigo) dependem da validação manual do passo 5.
- Não incluídos: exclusão de comunidade pela interface, fóruns, notificações de solicitação, comunidade sem criador (conta excluída → criador nulo).
