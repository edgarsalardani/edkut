# EdKut — Edição de perfil e avaliações sociais (migração 9)

> **Status de verificação (leia primeiro).**
> - `npm run build` **não foi executado** (o ambiente de desenvolvimento não tem rede para `npm install`). Rode `npm install && npm run build` e me envie qualquer erro.
> - Os testes de banco rodaram **somente em um PostgreSQL 16 local com uma emulação do Supabase** (papéis `anon`/`authenticated`, `auth.uid()`), **não no seu Supabase real**. Por isso o roteiro de testes no navegador (seção 7) é obrigatório antes de considerar pronto.
> - Nenhuma interface (React/Next) foi renderizada ou testada em navegador aqui. Os tipos foram checados contra stubs; a lógica pura (validação do formulário) tem testes em JS.
> - Nada foi executado no seu Supabase, e nada foi commitado.

## 1. O que mudou

**Editar perfil** — botão "editar perfil" (só no próprio perfil) → `/profile/edit`. Campos: nome, username, tipo de perfil, frase de apresentação, biografia, interesses, instituição, curso/área, localização, emoji e cor do avatar. A foto reutiliza `ProfileAvatarEditor` / `lib/avatarUpload.ts` (nenhum código de Storage duplicado). **Não exige migração**: os grants por coluna da migração 2 já cobrem os campos editáveis. E-mail, senha, `id`, datas e demais campos protegidos não são editados.

**Avaliações dos amigos** — NERD / PARCEIRO / TECH passam a ser a **média das notas (0–100) dadas por amigos**. Amigo vê sliders no perfil do amigo; o próprio dono e quem não é amigo não veem controles.

**Amizade real** (mínimo necessário, reaproveitando as tabelas da migração 3): enviar solicitação, cancelar, aceitar/recusar (também em `/friends`) e desfazer amizade. Usuários fictícios (`u1`, `u2`…) continuam simulados.

## 2. Como as avaliações são calculadas

- Cada amigo dá **três notas inteiras de 0 a 100** (NERD, PARCEIRO, TECH), salvas juntas. Uma linha por par avaliador→avaliado (`friend_ratings`); salvar de novo **substitui** (não duplica).
- **Média aritmética simples, peso igual por amigo**, por indicador. Ex.: TECH 80, 90, 100 → **90**. Arredonda ao inteiro (0,5 sobe).
- Sem nenhuma avaliação válida: **0%** e a legenda "ainda sem avaliações de amigos".
- A média **não é gravada** em lugar nenhum: é calculada na leitura pela função `profile_social_scores()`. Não existe coluna de média para alterar.
- **Voto válido** = existe amizade atual entre os dois **e** `friend_ratings.updated_at >= friendships.created_at`.
  - Amizade desfeita → o voto deixa de contar.
  - **Política da amizade restabelecida:** ao refazer a amizade nasce uma linha nova em `friendships`; os votos antigos continuam fora até o avaliador **salvar de novo**. A interface avisa e exige esse novo salvamento. Os votos antigos não são apagados.
- A interface mostra "calculado com a avaliação de N amigo(s)", sem revelar notas individuais.

## 3. Ordem de instalação

1. Faça backup / confira que as migrações 1–8 estão aplicadas (ok, segundo você).
2. **Supabase → SQL Editor:** execute **uma única vez** `supabase/migrations/20261114160001_friend_ratings.sql` (como `postgres`; tudo em transação; não apaga nem altera dados existentes e não toca `social_ratings`, `profile_scores`/`geek_base` nem as migrações 1–8).
3. Rode as consultas de conferência que estão no rodapé do arquivo.
4. Copie os arquivos do ZIP para o projeto (**atenção:** compare com mudanças locais recentes antes de sobrescrever, principalmente `ProfilePageClient.tsx`, `authService.ts`, `friendService.ts`, `types/index.ts`).
5. `npm install && npm run build`.
6. Rode o roteiro da seção 7.

**Migração antes ou depois do app?** Preferível antes. Se o app subir antes, nada quebra: os percentuais aparecem como 0% e o painel de avaliação mostra "recurso ainda não instalado (migração 9)".

Testes SQL opcionais (terminam em `ROLLBACK`, nada fica gravado): `supabase/tests/friend_ratings_smoke_test.sql` e `supabase/tests/profile_edit_smoke_test.sql`.

## 4. Segurança (no banco)

- RLS em `friend_ratings`; o usuário só **lê os próprios votos**. Inserir/alterar só como si mesmo e **somente se forem amigos agora**.
- Grants por coluna: o cliente informa apenas `rated_id` e as três notas; `rater_id` vem de `auth.uid()`; `created_at`/`updated_at` são do banco. Não há DELETE para o cliente.
- CHECKs: sem autoavaliação, notas 0–100, um voto por par (chave primária).
- Funções com `search_path` vazio e `EXECUTE` só para `authenticated`; `profile_social_scores` é a única `SECURITY DEFINER` (somente leitura).
- Perfil: a RLS `profiles_update_own` limita a edição à própria linha; o **username é protegido por índice único** — a checagem de disponibilidade na tela é só conforto, e a corrida entre dois salvamentos é tratada pelo erro `23505` do banco (testada com concorrência real no PG local).
- Chave `service_role` não é usada no front-end.

## 5. Limitações e observações

- **Privacidade:** se apenas **um** amigo avaliou, o dono do perfil consegue deduzir a nota dele (a média é a própria nota). O contador "N amigos" é público.
- Fotos de avatar continuam em bucket público (decisão anterior).
- Comentários, recados, depoimentos, comunidades e notificações continuam simulados; o centro de notificações da interface ainda é mock (as notificações de amizade existem como triggers no banco).
- Busca e sugestões de amigos ainda não listam usuários reais; para criar amizade real hoje, abra o perfil real da outra pessoa (`/profile/<uuid>`).
- `social_ratings` e `profile_scores` ficam sem uso (limpeza opcional futura).

## 6. Arquivos

Novos: `supabase/migrations/20261114160001_friend_ratings.sql`, `supabase/tests/friend_ratings_smoke_test.sql`, `supabase/tests/profile_edit_smoke_test.sql`, `src/app/profile/edit/page.tsx`, `src/components/{EditProfileForm,FriendshipButton,FriendRatingPanel}.tsx`, `src/lib/{profileEdit,ratings,friendships,uuid}.ts`, `src/services/socialService.ts`, este guia.
Modificados: `src/app/{home,friends}/page.tsx`, `src/app/profile/[id]/page.tsx`, `src/components/{ProfilePageClient,TechProfileIndicators,FriendRequestCard}.tsx`, `src/services/{authService,friendService}.ts`, `src/types/index.ts`.

## 7. Roteiro de testes no navegador

Preparação: crie as contas **A**, **B** e **C** (e-mail confirmado, se exigido) e uma **D** sem amizade. Use janelas anônimas separadas.

**Editar perfil**
1. Logado como A, abra seu perfil → aparece "editar perfil". No perfil de B **não** aparece.
2. Em `/profile/edit` os campos vêm preenchidos. Troque nome e biografia → "salvar alterações" → mensagem de sucesso; Header e perfil mostram o novo nome sem recarregar manualmente.
3. Recarregue (F5), saia e entre de novo → dados persistem.
4. Tente um username já usado por B → erro "já está em uso" (campo) e nada é salvo. Username vazio/curto/com maiúsculas-espaços → erro de validação.
5. Envie/troque a foto na mesma tela → continua funcionando; a foto aparece no perfil.
6. Tente acessar `/profile/edit` deslogado → vai para `/login`. Não há id na URL, então não dá para editar outro perfil.

**Avaliações**
7. A envia solicitação a B (perfil de B → "adicionar amigo"); B abre `/friends` (ou o perfil de A) e aceita.
8. B no perfil de A: vê "avalie A" com sliders. A no perfil de A: não vê. D no perfil de A: não vê.
9. B avalia A (ex.: TECH 80) → "Avaliação salva"; as barras de A atualizam sem F5 e mostram "calculado com a avaliação de 1 amigo".
10. B muda a nota → mesmo contador (1), valor novo (não duplica).
11. C vira amigo de A e dá TECH 100; um terceiro dá 90 → TECH de A = média (80, 90, 100 → 90).
12. A (dono) abre o próprio perfil → vê as barras, sem sliders; não há como alterar os percentuais.
13. Perfil sem avaliações → 0% e "ainda sem avaliações de amigos".
14. B desfaz a amizade com A → barras de A deixam de contar a nota de B; D e usuários sem amizade não conseguem votar (sem sliders).
15. Refaça a amizade → o painel avisa que a avaliação antiga não conta; só volta a valer após "atualizar avaliação".
16. Saia e entre de novo → notas e médias persistem.
17. (Opcional, console do navegador de B) tentar `rpc('rate_friend')` em alguém que não é amigo ou em si mesmo → erro do banco.
