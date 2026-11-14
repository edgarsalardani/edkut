# Melhorias de perfil e experiência nostálgica

> **Status:** implementado no código. **`npm run build` e o teste no navegador contra o seu Supabase NÃO foram executados pelo Claude** (sem internet/`npm install` no ambiente dele). Rode `npm install && npm run build` e siga o roteiro da seção 5.

## 1. Indicadores NERD · PARCEIRO · TECH
- Ordem e rótulos novos na interface: **NERD, PARCEIRO, TECH** (formato `NN%` e estilo mantidos; NERD usa a cor que era do GEEK, TECH a que era do TECH).
- Tipo `TechProfileScore` agora é `{ nerd, parceiro, tech }`. Mocks (16 usuários) convertidos mantendo os mesmos números (o antigo `geek` virou `nerd`). Legenda "o que significam os indicadores" na mesma ordem.
- **Banco: nada muda.** A coluna continua `profile_scores.geek_base` (e `social_ratings.geek`); `services/authService.ts` faz a tradução `nerd ← geek_base`. Não renomeei colunas nem mexi no cálculo (decisão D4 segue pendente).
- Só se, no futuro, você quiser que o banco também diga "nerd", será preciso uma migração separada (renomear `geek` → `nerd` em `social_ratings` e `geek_base`/`geek_sum` → `nerd_*` em `profile_scores`, e ajustar funções/views que os citam). Não é necessária para esta entrega e **não foi criada**.

## 2. Foto de perfil (Supabase Storage)

**Como funciona**
- Perfil próprio: link "adicionar foto / alterar foto" → escolher arquivo → **pré-visualização** (ainda não salva) → "salvar foto" ou "cancelar".
- Validação no navegador: JPEG/PNG/WebP, até 2 MB, e conferência dos primeiros bytes do arquivo (um `.txt` renomeado para `.png` é recusado).
- Envio para o bucket `avatars`, caminho `<id-do-usuário-autenticado>/<uuid>.<ext>`; depois grava **só o caminho** em `profiles.avatar_path` e apaga a foto anterior do próprio usuário (lida do banco). Cada foto tem nome novo (sem problema de cache).
- A **URL é montada pelo app** (`authService.ts`, via `getPublicUrl`) com o domínio do **próprio projeto**; o banco nunca guarda URL. Por isso é impossível apontar o avatar para um domínio externo — a constraint nem precisa conhecer domínios.
- Aparece em todo lugar que usa o avatar (perfil, Header, comentários, feed, amigos, scraps, depoimentos, busca, notificações). Sem foto (ou imagem que falha ao carregar) → o avatar padrão atual (emoji + cor).
- Persiste: o caminho fica em `profiles`; vale após logout/login.

**Segurança (aplicada no Supabase, não só no frontend)**
- Escrita no Storage só em `avatars/<seu-id>/<arquivo>.jpg|png|webp` (policy de INSERT confere `auth.uid()`, sem subpastas); só você lê/apaga a sua pasta. Não há policy de UPDATE.
- O bucket impõe 2 MB e os 3 tipos de imagem **no servidor** (Storage API).
- `profiles.avatar_path` tem `CHECK`: só `<próprio id>/<arquivo>.(jpg|png|webp)`, até 120 caracteres. `GRANT UPDATE` **somente** nessa coluna (aditivo às 11 colunas da migração 2); a policy `profiles_update_own` limita à própria linha. `id`, `created_at`, `updated_at` e a antiga `avatar_url` seguem sem permissão de escrita.
- Os avatares são **públicos por URL** (bucket público): quem tiver o link vê a imagem, sem login. O caminho contém o UUID do usuário e um UUID aleatório por foto (não é adivinhável), mas não é privado. Se quiser privacidade total no futuro, o caminho é bucket privado + URLs assinadas.
- Só a chave pública (anon) é usada. Nenhuma chave secreta.

### SQL a aplicar (uma vez) — `supabase/migrations/20261114140001_avatars_storage.sql`
> ⚠️ **Ordem:** aplique a migração **ANTES** de rodar/publicar esta versão do app. O app agora lê `profiles.avatar_path`; sem a coluna, a consulta de perfil falha.

1. Supabase → **SQL Editor** → *New query*.
2. Cole o conteúdo do arquivo (é a migração 8; as sete originais **não** foram alteradas) → **Run**. Está dentro de `begin … commit`: se algo falhar, nada é aplicado. Esperado: *Success. No rows returned*. Não rode duas vezes (a constraint e as policies não são idempotentes).
3. Conferência (somente leitura) — as três consultas estão no rodapé do arquivo (bucket, 3 policies, matriz de colunas atualizáveis).
4. Teste de fumaça (opcional, só em desenvolvimento): cole `supabase/tests/avatars_smoke_test.sql` e rode inteiro. Termina em `ROLLBACK`; esperado: "TODOS OS TESTES DE AVATAR PASSARAM". Ele **não** testa o limite de 2 MB nem os tipos MIME (isso é do Storage API — teste pelo app).
5. O rodapé da migração traz os comandos para desfazer.
6. Se o SQL Editor recusar criar policy em `storage.objects` (raro), crie pelo painel **Storage → Policies → bucket `avatars`** com as mesmas 3 regras, e o bucket em **Storage → New bucket** (Public ON, limite 2 MB, MIME `image/jpeg, image/png, image/webp`).

**Outras configurações do painel:** nenhuma (URL Configuration/Auth não mudam). Confira só que o limite global em *Project Settings → Storage* é ≥ 2 MB (o padrão é maior).


## 3. Emoticons nos comentários
- Botão com carinha ao lado do campo de comentário → seletor 3×3 com os desenhos e os códigos.
- Códigos: `:)` Feliz · `:(` Triste · `;)` Piscadinha · `:D` Risada · `:P` Língua · `:O` Surpreso · `(L)` Coração · `(H)` Óculos escuros · `:'(` Chorando. Também aceita a forma com nariz (`:-)`) e ignora maiúsculas/minúsculas.
- O emoticon entra **na posição do cursor** (ou no lugar do texto selecionado) e o foco volta ao campo. O texto guardado continua sendo o código; ao exibir o comentário, os códigos viram desenhos SVG **originais** (nada copiado do MSN). Texto normal funciona junto; "Meta:Python" ou "10:30" não viram emoticon.
- Teclado: Enter/Espaço abre o seletor; setas/Home/End navegam; Enter/Espaço escolhe; Esc fecha e volta o foco ao botão; Tab fecha. Mouse/toque: clique fora fecha. Responsivo (o campo encolhe, o seletor cabe em telas estreitas).
- **Reutilizável:** `lib/emoticons.ts` (catálogo + conversão), `components/Emoticon.tsx` (`<EmoticonText text=… />`), `components/EmoticonPicker.tsx`, `lib/useEmoticonInsertion.ts` (hook para ligar o seletor a qualquer `<input>`/`<textarea>`). Para scraps/depoimentos basta usar `<EmoticonText>` onde o texto é exibido e o hook + picker no formulário.
- Comentários continuam **mockados** (sem persistência real). Quando forem ao banco, nada muda aqui: o texto salvo é o próprio código.

## 4. Arquivos
**Novos**
```
supabase/migrations/20261114140001_avatars_storage.sql
src/lib/avatarUpload.ts              validação + envio da foto + gravação de avatar_path
supabase/tests/avatars_smoke_test.sql   teste de fumaça da migração 8 (termina em ROLLBACK)
src/components/ProfileAvatarEditor.tsx  avatar do perfil próprio: escolher → pré-visualizar → salvar
src/lib/emoticons.ts                 catálogo, parser de texto, inserção no cursor
src/components/Emoticon.tsx          desenhos SVG + <EmoticonText>
src/components/EmoticonPicker.tsx    botão + seletor acessível
src/lib/useEmoticonInsertion.ts      hook de inserção na posição do cursor
docs/supabase/MELHORIAS_PERFIL.md    este guia
```
**Modificados**
```
src/types/index.ts                   TechProfileScore {nerd, parceiro, tech}; User.avatarUrl?
src/mocks/users.ts                   techProfile no novo formato (mesmos valores)
src/components/TechProfileIndicators.tsx   ordem/rótulos
src/components/ProfilePageClient.tsx       legenda NERD/PARCEIRO/TECH + editor de foto no perfil próprio
src/components/Avatar.tsx            mostra a foto (fallback: emoji+cor); virou Client Component
src/components/PostCard.tsx          botão/seletor de emoticons no campo de comentário
src/components/Comment.tsx           exibe emoticons no texto
src/services/authService.ts          lê avatar_path e monta a URL; mapeia geek_base -> nerd
README.md, docs/supabase/ETAPA2_AUTH.md    só o texto "Tech·Parceiro·Geek" -> "Nerd·Parceiro·Tech"
```

## 5. Roteiro de teste no navegador (`npm run dev`)
**Indicadores**
1. Home: o card do seu perfil (esquerda) mostra **NERD · PARCEIRO · TECH** (novo usuário: 0% nos três).
2. `/profile/u1` (mock): **NERD 98% · PARCEIRO 91% · TECH 96%**; a legenda à direita está na mesma ordem.

**Foto**
3. Abra seu perfil (clique no seu nome). Abaixo do avatar: "adicionar foto".
4. Escolha uma imagem JPEG/PNG/WebP < 2 MB → aparece a pré-visualização com "salvar foto / cancelar". "Cancelar" volta ao anterior.
5. "Salvar foto" → mensagem "foto atualizada!"; o avatar muda no perfil **e no Header** (canto superior direito).
6. F5; depois **sair e entrar** de novo: a foto continua. O link passa a dizer "alterar foto". Trocar de novo apaga a anterior (Storage → avatars → sua pasta: 1 arquivo).
7. Recusas: um `.gif`, um arquivo > 2 MB e um `.txt` renomeado para `.png` → mensagem de erro em português, nada é enviado.
8. Comente num post: seu avatar com foto aparece no campo e no comentário publicado. Perfis sem foto continuam com o emoji.
9. Segurança: rode `supabase/tests/avatars_smoke_test.sql` (seção 2) — cobre pasta alheia, domínio externo, colunas proibidas e policies de Storage.

**Emoticons**
10. Na Home, clique em "comentar" num post → ao lado do campo está a carinha. Clique: abre o seletor 3×3.
11. Digite `ab cd`, coloque o cursor entre `ab` e `cd`, abra o seletor e escolha :D → fica `ab :D cd` e o foco volta ao campo. Selecione uma palavra e escolha um emoticon → substitui a seleção.
12. Envie o comentário: os códigos viram carinhas pequenas; o texto normal segue igual. Digite `Meta:Python` e `10:30`: continuam texto.
13. Digitar `:)`, `(L)`, `(H)`, `:'(` à mão também vira emoticon no comentário publicado.
14. Teclado: Tab até a carinha → Enter (abre) → setas (navegam) → Enter (insere) ; Esc fecha. Reduza a janela (≈360 px): campo e seletor continuam utilizáveis.
