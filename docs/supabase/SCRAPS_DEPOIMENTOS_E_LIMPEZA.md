# EdKut — Scraps e depoimentos reais + remoção dos dados fictícios (migração 10)

> **Verificação (leia primeiro).**
> - `npm run build` **não foi executado**: o ambiente de desenvolvimento não tem rede para `npm install`. Rode `npm install && npm run build` e me envie qualquer erro.
> - Nenhuma tela foi aberta em navegador. O que foi verificado: (a) tipos TypeScript contra stubs de React/Next (sem erros além dos esperados dos stubs); (b) 101 testes em JS da lógica e dos serviços com um cliente Supabase simulado (busca 36, edição de perfil 36, scraps/depoimentos 29); (c) as regras de banco, num PostgreSQL 16 local com emulação do Supabase — **não no seu Supabase real**; (d) uma checagem automática do grafo de imports: **nenhum arquivo alcançável a partir das rotas do app importa `src/mocks`**.
> - Nada foi executado no seu Supabase e nada foi commitado.

## 1. Migration (necessária) — `20261115120001_scraps_friends_only.sql`

**Por quê:** a policy `scraps_insert_own` (migração 6) só exigia `author_id = auth.uid()`: qualquer usuário logado podia escrever no perfil de qualquer pessoa. Comprovado no banco local: o teste "não-amigo não pode enviar scrap" **falha antes** da migration e **passa depois**.

**O que faz:** um único `ALTER POLICY` — INSERT em `scraps` exige `author_id = auth.uid()` **e** `profile_owner_id <> author_id` **e** `are_friends(author, dono)`. Não recria tabelas, não apaga nem altera scraps existentes, não toca nas migrações 1–9; leitura e exclusão continuam como eram. Scraps antigos permanecem mesmo que a amizade termine (a regra vale ao *enviar*).

**Como executar:**
1. Supabase → SQL Editor → cole o arquivo inteiro → **Run** (uma vez, como `postgres`).
2. Rode a consulta de conferência do rodapé do arquivo: o `with_check` de `scraps_insert_own` deve conter `are_friends` e `profile_owner_id <> author_id`.
3. **Ordem:** aplique a migration **antes** (ou junto) de publicar o app novo. Se o app subir antes, a interface já só oferece o formulário a amigos, mas o banco ainda aceitaria scrap de não-amigo até a migration rodar.
4. Opcional (somente em projeto de **desenvolvimento**): `supabase/tests/scraps_testimonials_smoke_test.sql` — cria 4 usuários de teste e termina em ROLLBACK. Esperado: "TODOS OS TESTES PASSARAM".
5. Para desfazer: o comando está no rodapé da migration.

**Depoimentos não precisaram de migration:** as políticas existentes já implementam tudo (nasce `pending`; só o destinatário aprova/recusa; só `approved` é público; autor vê o próprio; 1 pendente por par; sem autodepoimento). O teste SQL cobre cada uma.

## 2. O que foi implementado

**Scraps** (tabela `scraps`): enviar, listar e apagar com persistência real.
- O formulário só aparece para **amigos** (e nunca no próprio perfil); a regra real está no banco. Para quem não é amigo, a tela explica (e, se houver solicitação pendente, informa o estado).
- Cada scrap mostra nome, avatar e link do **autor real**. Mensagens de sucesso e de erro. **Se o envio falhar, o texto digitado é mantido.** Contador de 0–1000 caracteres.
- O dono do perfil apaga qualquer scrap recebido; o autor apaga o próprio (confirmação em duas etapas).
- Perfil → aba "recados" e página `/scraps` (corrigido o bug em que `/scraps` tratava seu próprio perfil como alheio). Carrega os 50 mais recentes.

**Depoimentos** (tabela `testimonials`):
- Qualquer usuário envia a outro; nasce `pending`. Mensagem: "aparecerá no perfil depois que fulano aprovar".
- **Destinatário** (perfil dele e `/testimonials`): seções "aguardando sua aprovação", "publicados no seu perfil" e "recusados", com **aprovar / recusar / tirar do perfil / apagar**. A aba "depoimentos" mostra "(n)" quando há pendentes.
- **Visitantes**: só veem os aprovados. **O autor** acompanha os seus (etiqueta "aguardando aprovação" ou "recusado") e pode apagá-los. Depois de decidido, pode enviar outro; enquanto houver um pendente, o formulário some (regra do banco: 1 pendente por par).
- Autor real (nome, avatar, link) em todos os cartões; estados vazios e de erro de carregamento tratados.

## 3. Dados fictícios removidos (por seção)

| Seção | Antes | Agora |
|---|---|---|
| Home — feed | posts inventados | aviso "publicações ainda não estão disponíveis" + atalhos reais (buscar pessoas, scraps, depoimentos, editar perfil); sem caixa de publicar (não persistiria) |
| Home — comunidades (minhas/sugestões) | comunidades inventadas | seção removida |
| Home — amigos | misto | amigos reais; vazio: "Você ainda não tem amigos. buscar pessoas" |
| Home — cartão de perfil | contador de comunidades, bio vazia | só dados reais; sem contador de comunidades |
| Perfil — aba "publicações" e caixa de comunidades | posts/comunidades inventados | removidos (voltam quando forem integrados) |
| Perfil — scraps e depoimentos | mocks | reais (acima) |
| Perfil — amigos | real/mock | real; vazio com mensagem apropriada |
| Perfis `/profile/u1`… | abriam usuários fictícios | **404** (só existem perfis reais, id UUID) |
| Busca | comunidades e posts inventados | só **pessoas reais** |
| Comunidades `/communities` e `/communities/[id]` | 12 comunidades inventadas, criar/entrar locais | aviso "ainda não disponíveis"; `/communities/[id]` → 404 |
| Notificações e contador do Header | notificações e número inventados | aviso honesto; sem contador |
| Indicador "online" (bolinha verde) | verde no próprio usuário | removido em toda a interface |
| Solicitações de amizade | fictícias | só as reais (`friend_requests`) |
| Sugestões de amizade | mocks (não exibidas) | não existem; a descoberta é pela busca |

Regras seguidas: nenhum dado fixo substituiu os mocks; vazio ou erro do Supabase **nunca** vira dado inventado (falha de leitura mostra aviso de erro, não "nenhum item"); nenhum registro real do Supabase foi apagado.

## 4. Arquivos

**Novos:** `supabase/migrations/20261115120001_scraps_friends_only.sql`, `supabase/tests/scraps_testimonials_smoke_test.sql`, `src/lib/scraps.ts`, `src/lib/testimonials.ts`, este guia.

**Modificados:** `src/types/index.ts`; `src/services/{authService,socialService,friendService,scrapService,testimonialService}.ts`; `src/components/{AppShell,FriendGrid,FriendsPageClient,ProfileAvatarEditor,ProfileCard,ProfilePageClient,ProfileScrapsSection,ProfileTestimonialsSection,ScrapCard,Search,TestimonialCard}.tsx`; `src/app/{home,notifications,communities,scraps,search,testimonials}/page.tsx`, `src/app/communities/[id]/page.tsx`, `src/app/profile/[id]/page.tsx`.

Autenticação, edição de perfil, upload de avatar, amizades, busca de pessoas e avaliações NERD/PARCEIRO/TECH foram preservados (mudanças nesses arquivos se limitam a remover o fallback de mocks e o indicador online).

**Arquivos agora INATIVOS** (nenhuma rota os alcança; ficam para as etapas de feed/comunidades/notificações e **não aparecem na interface**): `components/{AddFriendButton,Comment,CommunitiesPageClient,CommunityGrid,CommunityHeader,CreatePostBox,Emoticon,EmoticonPicker,NotificationList,PostCard,PostFeed}.tsx`, `lib/{emoticons,useEmoticonInsertion}.ts`, `services/{communityService,notificationService,postService,searchService,simulateDelay,userService}.ts` e a pasta `src/mocks/`. Mantive todos para não perder o trabalho dos emoticons e dos componentes de feed; **podem ser apagados com segurança depois que o build passar** se você preferir limpar já (a checagem de imports confirma que nada ativo depende deles). Os da pasta `mocks` e os serviços mockados só deixam de ser necessários quando as etapas correspondentes forem feitas.

## 5. Roteiro de teste com Edgar e Kaio Pesca

Pré-requisitos: migration 10 aplicada; Edgar e Kaio já são amigos (do teste anterior). Use duas janelas (uma anônima).

**Scraps**
1. **Edgar** → perfil do Kaio → aba **recados**: aparece o formulário. Escreva "Fala, Kaio!" → **enviar scrap**. O recado aparece no topo com o **nome, avatar e link do Edgar** e a mensagem "Recado enviado para Kaio!". Atualize (F5): continua lá.
2. **Kaio** → seu perfil (aba recados) ou menu **scraps**: vê o recado do Edgar. Clique **apagar → sim, apagar**: some e continua sumido após F5. (Edgar, no perfil do Kaio, também vê o recado sumir.)
3. **Texto preservado em falha:** como Edgar, abra o DevTools (F12) → Network → "Offline", escreva um recado e envie: aparece o erro de conexão **e o texto continua na caixa**. Volte para "Online" e envie de novo.
4. **Regra de amizade:** Edgar → perfil do Kaio → **desfazer amizade → desfazer**. Atualize o perfil do Kaio: o formulário **sumiu** e aparece "Somente amigos podem deixar recados…". O recado antigo (se existir) continua visível. Refaça a amizade (Edgar adiciona, Kaio aceita): o formulário volta.
5. Em um perfil próprio não há formulário ("Aqui aparecem os recados que seus amigos deixam…").
6. Prova no banco: o teste SQL do item 4 da seção 1 confirma que o banco recusa scrap de não-amigo mesmo se alguém burlar a interface.

**Depoimentos**
7. **Edgar** → perfil do Kaio → aba **depoimentos** → escreva e **enviar depoimento**. Aparece "Depoimento enviado! Ele aparecerá… depois que Kaio aprovar" e, em "seu depoimento", a etiqueta **aguardando aprovação**. O formulário some (já há um pendente).
8. Com uma **terceira conta** (ou o Edgar de outra janela como visitante), abra o perfil do Kaio: **não** vê o depoimento pendente.
9. **Kaio** → seu perfil: a aba mostra **depoimentos (1)**. Abra: "aguardando sua aprovação" com o texto e o autor. Clique **aprovar** → vai para "publicados no seu perfil".
10. Edgar (e a terceira conta) vê o depoimento **publicado** no perfil do Kaio. Atualize: persiste.
11. Kaio clica **tirar do perfil** → some do público; Edgar vê a etiqueta **recusado** no "seu depoimento" e pode **apagar**. Kaio pode **aprovar** de novo em "recusados".
12. Edgar envia outro depoimento e Kaio **recusa** → Edgar vê "recusado" e pode enviar um novo.

**Sem dados fictícios**
13. Percorra **Home, Amigos, Busca, Comunidades, Notificações e os perfis**: não há "Lucas", "Marina" nem posts/comunidades inventados. Abra `/profile/u1` e `/communities/c1`: **página não encontrada**. Uma conta nova mostra "Você ainda não tem amigos. buscar pessoas".
14. Em tela estreita (~360 px) os formulários, cartões e botões quebram linha sem cortar texto.

## 6. Limitações e observações

- **Notificações ainda não existem na interface.** O banco já gera as linhas (recado, depoimento, amizade), mas o destinatário só descobre entrando em `/scraps`, `/testimonials` ou na aba (n) do perfil. É o candidato natural à próxima etapa.
- Feed, curtidas, comentários e comunidades continuam sem integração (estados vazios/avisos). A navegação "comunidades" leva a um aviso.
- Scraps e depoimentos não são editáveis (o banco não prevê edição). Mostram os 50 mais recentes (sem paginação).
- Depoimentos **não exigem amizade** (mantive a regra existente do banco); só os scraps passaram a exigir.
- Um depoimento recusado continua visível ao autor com a etiqueta "recusado" (é o que as políticas atuais permitem e o que "acompanhar o status" pede).
- Segurança pendente do plano de lançamento (rate limit, confirmação de e-mail, termos/LGPD etc.) não faz parte desta etapa.
