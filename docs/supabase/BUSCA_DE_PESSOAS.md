# EdKut — Busca de pessoas (Etapa 1 da integração real)

> **Verificação (leia primeiro).**
> - `npm run build` **não foi executado** (sem rede para `npm install`). Rode `npm install && npm run build`.
> - Nenhuma tela foi aberta em navegador. Testado: lógica da busca e do serviço (36 testes em JS com um cliente Supabase simulado) e as consultas SQL em um PostgreSQL 16 local com emulação do Supabase — **não no seu Supabase real**.
> - **Nenhuma migration é necessária.** A tabela `profiles` e sua RLS (`profiles_select_authenticated`) já permitem a leitura; nenhuma política foi alterada.

## O que mudou

- `/search?q=...` passa a buscar **pessoas reais** em `public.profiles`, por **nome** (todas as palavras digitadas, em qualquer ordem) ou **@username**. Mínimo de 2 caracteres; até 24 resultados, ordenados por relevância (username exato, username que começa com o texto, nome que começa com o texto, demais).
- Cada resultado mostra foto, nome, @username, tipo e frase de apresentação; foto e nome levam ao perfil real (`/profile/<id>`).
- O botão de amizade é o **mesmo sistema já implementado** (`FriendshipButton`), com os estados: **adicionar amigo**, **solicitação enviada** (com "cancelar solicitação"), **aceitar / recusar** (solicitação recebida) e **vocês já são amigos**. Na lista o botão aparece em versão compacta, sem "desfazer amizade" (isso continua no perfil).
- Você não aparece nos próprios resultados.
- Usuários fictícios **não entram** nos resultados de pessoas, e não há fallback para dados fictícios: se a consulta falhar, aparece "Não foi possível buscar pessoas agora"; se não houver ninguém, "Nenhuma pessoa encontrada para …".
- Segurança: só as colunas públicas da lista são lidas (id, nome, username, tipo, frase, instituição, avatar). Nunca e-mail. Os curingas `%`, `_` e `\` digitados são tratados como texto, e o texto vai como valor de filtro (não dentro de `.or(...)`), então não altera a consulta.

## Arquivos

Novos: `src/lib/peopleSearch.ts`, `src/services/peopleSearchService.ts`, `src/components/PersonResultCard.tsx`, `supabase/tests/people_search_smoke_test.sql`, este guia.
Modificados: `src/app/search/page.tsx`, `src/services/searchService.ts` (deixa de devolver pessoas fictícias), `src/services/authService.ts` (+ `searchProfilesByText`, só acrescenta), `src/services/socialService.ts` (+ `getFriendshipStates`), `src/components/FriendshipButton.tsx` (+ prop opcional `compact`; `onChange` agora opcional).

Autenticação, edição de perfil, avaliações e foto **não foram alteradas**.

## Como instalar

1. Copie os arquivos do ZIP (compare antes com mudanças locais, especialmente `authService.ts`, `socialService.ts` e `FriendshipButton.tsx`, que já tinham sido alterados na entrega anterior).
2. `npm install && npm run build` e depois `npm run dev`.
3. (Opcional) Rode `supabase/tests/people_search_smoke_test.sql` no SQL Editor de um projeto de **desenvolvimento**: cria 4 usuários de teste e termina em ROLLBACK.

## Teste com duas contas reais (A e B)

Pré-requisito: migrations 1–9 aplicadas (a 9 só é necessária para as avaliações; a busca e as solicitações funcionam sem ela). Use duas janelas (uma anônima). Crie as contas **A** ("Ana Teste", `ana.teste`) e **B** ("Bruno Teste", `bruno.teste`).

1. **A** → barra de busca → `bruno` → aparece **Bruno Teste**, `@bruno.teste`, com foto (ou emoji) e botão **adicionar amigo**. A própria Ana não aparece.
2. Busque também `@bruno.teste`, `bruno.te`, `teste bruno` e `BRUNO` → todos encontram o Bruno (primeiro o username exato).
3. Busque `a` (1 caractere) → mensagem "Digite pelo menos 2 caracteres". Busque `zzzzzz` → "Nenhuma pessoa encontrada para “zzzzzz”".
4. Clique no nome ou na foto do Bruno → abre o **perfil real** dele.
5. Volte à busca e clique em **adicionar amigo** → vira "solicitação enviada" + "cancelar solicitação". Recarregue (F5): continua "solicitação enviada".
6. **B** → busque `ana` → aparece Ana com "quer ser seu amigo" + **aceitar / recusar**. Clique **aceitar** → "vocês já são amigos".
7. **A** → recarregue a busca por `bruno` → "vocês já são amigos". Os dois aparecem em `/friends` e no perfil um do outro (sliders de avaliação aparecem nos perfis, se a migration 9 estiver aplicada).
8. Teste de cancelamento: com uma terceira conta C, envie a solicitação e depois **cancele**; volta para "adicionar amigo".
9. Conferência: nenhum nome fictício (Lucas, Marina etc.) aparece em "pessoas".
10. Responsivo: estreite a janela (≈360 px): foto, nome e botão quebram linha sem cortar o texto.

## Limitações e observações

- **Acentos:** a busca é insensível a maiúsculas, mas **não a acentos**: "joao" não encontra "João" (digitar "joão" encontra). Corrigir exige uma migration pequena (extensão `unaccent` + índice); não foi feita para respeitar "sem migration salvo necessidade". Recomendo como próximo passo (um teste SQL de comprovação está no arquivo `people_search_smoke_test.sql`, item 6).
- **Escala:** o índice trigram existe para `name`; para `username` há só o índice único comum, então a busca parcial por username faz varredura. Sem problema no tamanho atual; vale um índice trigram em `username` mais tarde.
- **Comunidades e publicações** na página de busca continuam **mockadas** (fora desta etapa). Elas ainda podem mostrar dados fictícios abaixo da seção "pessoas". Se preferir, escondo essas duas seções até as etapas correspondentes.
- **Privacidade:** qualquer conta logada consegue buscar todas as contas (por desenho de `profiles_select_authenticated`). E-mail nunca é buscável nem exposto. Contas com e-mail ainda não confirmado também aparecem enquanto "Confirm email" estiver desligado no painel.
- Sem limite de requisições (rate limit) na busca ainda: está na etapa de endurecimento.
