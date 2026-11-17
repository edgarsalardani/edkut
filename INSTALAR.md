# EdKut — Entrega 5: fóruns de discussão das comunidades

Cada comunidade ganha abas **informações | fórum | membros | administração**. No fórum: lista de tópicos (mais recentemente ativos primeiro),
criar tópico, comentar, **responder a um comentário (um nível)**, emoticons (o seletor que já existe), apagar com confirmação e moderação.
Tudo guardado no Supabase, com as permissões garantidas por **RLS e gatilhos no banco** (não só pela tela).
Nada foi aplicado no seu Supabase; sem commit/push; LaTeX e demais recursos intocados.

## 1. Pré-requisitos
Migrations 1–14 aplicadas (a 15 usa `is_community_member`, da 12, e `is_community_moderator`, da 4). A numeração 15 estava livre (a 14 é do perfil clássico).

## 2. Instalação (nesta ordem)
1. Backup/branch do projeto e do banco. Teste primeiro em um projeto Supabase de **desenvolvimento**.
2. SQL Editor → cole e execute **`supabase/migrations/20261117150001_community_forum.sql`** inteiro (transação única: se falhar, nada é aplicado). Conferência e "como desfazer" estão em comentários no fim do arquivo.
3. Copie o conteúdo deste ZIP sobre a raiz do projeto, mantendo as pastas. Publique o app **depois** da migration.
4. Opcional (DEV): rode `supabase/tests/community_forum_smoke_test.sql` no SQL Editor — cria usuários de teste e termina em ROLLBACK.

## 3. Arquivos
**Novos (7):**
- `supabase/migrations/20261117150001_community_forum.sql`
- `supabase/tests/community_forum_smoke_test.sql`
- `src/lib/forum.ts` — regras, validações e chamadas ao Supabase (navegador)
- `src/components/CommunityForum.tsx` — lista de tópicos, criar tópico
- `src/components/ForumTopicView.tsx` — tópico, comentários, respostas, moderação
- `src/components/ForumAuthor.tsx` — foto + nome do autor (link para o perfil)

**Substituídos (3):**
- `src/components/CommunityPageClient.tsx` — novas abas "informações" e "fórum"; removido o aviso provisório "o fórum chega na próxima entrega"; o resto (membros, administração, entrar/sair) é igual
- `src/app/communities/[id]/page.tsx` — lê `?aba=` e `?topico=` da URL
- `src/types/index.ts` — acrescenta os tipos do fórum no final

## 4. Banco de dados (migration 15)
- **`community_topics`** (título 3–120, mensagem inicial 1–5000, `reply_count`, `last_activity_at`) e **`community_topic_replies`** (comentário = `parent_id` nulo; resposta = `parent_id` de um comentário do **mesmo** tópico; 1–2000 caracteres). Mesma modelagem prevista, com `parent_id` para as respostas. Nenhuma tabela existente foi alterada (`posts`, `scraps`, `testimonials`, amizades, comunidades).
- **Permissões (RLS):** ler = qualquer usuário autenticado · criar tópico/comentar/responder = **só membro** (quem saiu ou foi removido perde na hora; solicitação pendente não conta) · apagar = o **autor** ou o **criador/moderador** da comunidade.
- **Imutável:** não há UPDATE para o cliente, então ninguém troca autor, comunidade ou tópico. O cliente só informa `(community_id, title, body)` / `(topic_id, parent_id, body)`; autor vem de `auth.uid()`; a comunidade da mensagem é copiada do tópico por gatilho + chave estrangeira composta.
- **1 nível:** gatilho recusa resposta a resposta (erro 23514). Apagar comentário apaga suas respostas; apagar tópico apaga tudo dele.
- **Contadores reais:** `reply_count` (comentários + respostas) e `last_activity_at` mantidos por gatilho e recalculados ao apagar.
- **Anti-abuso (por autor):** máx. 5 tópicos/10 min e 15 mensagens/min (erro 54000); mensagem idêntica repetida no mesmo tópico em 60 s é recusada. Texto normalizado no banco (pontas aparadas, caracteres de controle descartados).
- **HTML:** guardado e exibido como **texto puro** (a tela nunca interpreta HTML; `<script>` aparece literalmente).
- **Conta excluída:** a conversa permanece e o autor aparece como "usuário indisponível".
- **Índices** para a lista por atividade, comentários por tópico, respostas por comentário e limites por autor. **Futuro (denúncias):** uma tabela `community_topic_reports` apontando para tópico/mensagem.

## 5. Decisões aplicadas (revise)
1. Qualquer usuário autenticado **lê** o fórum, inclusive de comunidade com entrada por aprovação (como o restante do app).
2. Quem saiu/foi removido **não publica**, mas ainda pode **apagar o que ele mesmo escreveu**.
3. O autor de um tópico apaga o **próprio tópico** (e as mensagens dele); **não** apaga mensagens de outras pessoas — isso é do criador/moderador da comunidade. Se quiser que o autor do tópico também modere o próprio tópico, é uma policy a mais.
4. Moderadores podem apagar conteúdo de qualquer pessoa, inclusive de outro moderador ou do criador (sem hierarquia entre eles).
5. Sem edição de tópicos/mensagens nesta versão (garante a integridade de autor/conteúdo).
6. A aba padrão da comunidade passou a ser **"informações"** (antes era "membros"); `?aba=forum` abre o fórum e `?topico=<id>` abre um tópico (o F5 mantém o lugar).
7. Paginação por faixa: 20 tópicos e 20 comentários por página ("carregar mais"); respostas vêm junto dos comentários carregados (até 500).

## 6. Checklist de testes manuais (contas: A = criador, B = membro, C = moderador promovido, D = sem ser membro)
1. Comunidade → aba **fórum**: lista vazia mostra o convite; B clica "criar tópico", cria um tópico com emoticon → abre o tópico; volta e ele está no topo com 0 mensagens.
2. D abre o fórum: **lê** tópicos e comentários, **não** vê "criar tópico", comentar nem responder; mostra o aviso para entrar.
3. D (comunidade com aprovação, pedido pendente): mesmo comportamento, aviso de "aguardando aprovação".
4. B comenta (use o seletor de emoticons); A responde ao comentário → resposta aparece recuada, vinculada ao comentário; respostas não têm "responder".
5. Atualize a página (F5) dentro do tópico: continua no mesmo tópico, com tudo salvo; o contador na lista confere.
6. B apaga a **própria** mensagem (pede confirmação); B **não** vê "apagar" nas mensagens dos outros.
7. C (moderador) apaga um comentário alheio (a confirmação avisa que as respostas vão junto) e um tópico inadequado; A (criador) também.
8. A remove B da comunidade (aba membros): B ainda lê, mas não consegue mais criar/comentar/responder (mensagem clara); ao reentrar volta a poder.
9. Publique várias vezes seguidas (ou repita a mesma mensagem): aparece o aviso de limite/repetição.
10. Cole `<script>alert(1)</script>` num comentário: aparece como texto, nada executa.
11. Celular (≈390 px): lista, tópico e formulários sem rolagem horizontal.
12. Regressão: entrar/sair/solicitar participação, administração, imagem da comunidade, perfil, recados, depoimentos, fotos e vídeos como antes.

## 7. Testes executados — e limites
**Executado de verdade (ambiente local de teste):**
- **Migration 15 + teste SQL** num PostgreSQL 16 local com **emulação** do Supabase (roles, `auth.uid()`, RLS real do Postgres) junto com as migrations 1–14 — membro cria/comenta/responde; não membro, pendente, removido e anônimo recusados pelo banco; autor/comunidade imutáveis; profundidade de 1 nível; apagar (autor, moderador, criador, cascata, contadores); limites de tamanho; HTML como texto; repetição e frequência; conta excluída; comunidade apagada.
- **Interface no Chromium** (Playwright, 78 verificações) com Supabase **simulado em memória**: lista, ordenação, criar tópico, comentar, responder, emoticons nos 3 campos, persistência após recarregar, apagar com confirmação (autor/moderador/criador), visitante e pendente, paginação, HTML como texto, erros do servidor, 360/390 px sem rolagem horizontal. Mais **15 grupos de lógica** (validações, agrupamento, URL, mensagens de erro).
- **Regressão:** testes SQL de comunidades, avatares, avaliações, busca, perfil clássico, edição de perfil, scraps/respostas e depoimentos, e as interfaces de comunidades (uitest2), perfil, Home — todos passando; checagem de tipos TypeScript com stubs.
- Ajuste de teste: a interface de comunidades agora é testada abrindo a aba "membros" explicitamente (a aba padrão mudou).

**NÃO verificado:** `npm run build`/lint do seu projeto; **Supabase real** (Auth, PostgREST, Storage, RLS via API HTTP — as políticas foram testadas direto no Postgres local, e a interface só com cliente simulado); o CSS dos testes foi compilado com Tailwind v4 (aproximação do seu build); desempenho com volume real de dados.
**Teste antigo já desatualizado (não é da entrega 15):** `s1/supabase/tests/rls_smoke_test.sql` falha na asserção "postagem aberta", porque a migration 12 passou a exigir ser membro para postar em comunidade.

## 8. Fora desta entrega
Feed geral, notificações do fórum, denúncias, edição de mensagens, bloqueio/fixação de tópicos, documentação LaTeX.
