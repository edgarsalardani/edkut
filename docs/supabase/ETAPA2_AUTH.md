# Etapa 2 — Autenticação real com Supabase Auth

> **Status:** implementada no código; **`npm run build` NÃO foi executado** (o ambiente de desenvolvimento do Claude não tem acesso à internet e `npm install` não completa lá). Rode `npm install && npm run build` no seu computador **antes** de tudo.

## 1. O que mudou

| Antes | Agora |
|---|---|
| "Entrar" sempre abria a conta demo (flag em `localStorage`) | `signInWithPassword` no Supabase Auth |
| Não existia cadastro | Cadastro real: **nome, username, e-mail e senha** |
| Sessão = flag no navegador | Sessão em **cookies** (`@supabase/ssr`), validada no servidor; sobrevive ao F5 |
| Todas as páginas abertas | **Middleware** manda para `/login` quem não está logado; logado em `/login` ou `/` vai para `/home` |
| `getCurrentUser()` = Edgar (mock) | `getCurrentUser()` = **usuário logado + linha da tabela `profiles`** |
| Logout apagava a flag | `signOut` real (encerra a sessão deste navegador) |

O que **continua mockado**: amigos, comunidades, feed, comentários, scraps, depoimentos, notificações, busca. Os usuários fictícios (u1…u16) seguem existindo para popular a rede; o perfil de um usuário **real** abre em `/profile/<uuid>` e o de um fictício em `/profile/u1` etc.

## 2. Arquivos

**Novos**
```
src/lib/supabase/env.ts          lê URL + chave pública (erro claro se faltarem)
src/lib/supabase/client.ts       cliente do navegador
src/lib/supabase/server.ts       cliente de Server Components / route handlers
src/lib/supabase/middleware.ts   renova sessão e protege rotas
src/middleware.ts                ponto de entrada do middleware (matcher)
src/app/auth/callback/route.ts   destino do link do e-mail de confirmação
src/services/authService.ts      usuário logado + perfis reais (somente servidor)
docs/supabase/ETAPA2_AUTH.md     este guia
docs/supabase/PENDENCIAS_SEGURANCA.md
```
**Modificados**
```
package.json                     + @supabase/ssr, @supabase/supabase-js
.env.example                     comentário da variável opcional
src/lib/session.ts               agora: signIn / signUp / signOut (Supabase)
src/services/userService.ts      removido getCurrentUser (demo); só mocks de usuários fictícios
src/app/login/page.tsx           lógica real + modo "criar conta"; layout/classes preservados
src/components/Header.tsx        logout real (só a função; visual idêntico)
src/components/AppShell.tsx      import de getCurrentUser
src/app/{home,friends,communities,communities/[id],profile/[id],scraps,testimonials,search,notifications}/page.tsx
                                 import de getCurrentUser (+ profile/[id] usa getProfileUserById)
src/components/PostCard.tsx, ProfileScrapsSection.tsx, ProfileTestimonialsSection.tsx
                                 resolvem o autor "eu" a partir de currentUser (o UUID real não existe nos mocks)
src/components/ProfilePageClient.tsx
                                 bio vazia mostra "ainda não escreveu nada sobre si" (antes: só aspas)
```
Não alterados: visual do login, Home, Header, perfil, `globals.css`, `tailwind.config.ts`, mocks, `supabase/`.

## 3. Configurar as variáveis de ambiente

1. No Supabase: **Project Settings → API** (ou *API Keys*). Copie:
   - **Project URL** (`https://xxxx.supabase.co`)
   - a chave **pública** (`anon` ou `publishable`).
2. Na raiz do projeto:
   ```bash
   cp .env.example .env.local
   ```
3. Edite `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-publica
   ```
4. **Reinicie** o `npm run dev` (variáveis só são lidas na inicialização).

🔒 **Nunca** coloque a chave `service_role`/`secret` no `.env.local` do app, no código ou em chats. O app não precisa dela. `.env.local` já está no `.gitignore`.

## 4. Configurar o Supabase Auth (uma vez)

**Authentication → URL Configuration**
- **Site URL:** `http://localhost:3000`
- **Redirect URLs:** adicione `http://localhost:3000/auth/callback` (e, depois, a URL de produção).

**Authentication → Providers → Email**
- Para testes rápidos você pode **desligar "Confirm email"** (o cadastro já entra logado). **Religue antes de abrir ao público.**
- Com "Confirm email" ligado, o e-mail de confirmação é enviado pelo servidor de e-mail embutido do Supabase, que tem **limite muito baixo de envios por hora** (confira o valor atual na documentação). Para uso real, configure um SMTP próprio.
- A senha mínima do projeto vem das configurações do Auth; o app exige **8 caracteres** (validação no formulário).

## 5. Testar o primeiro cadastro real

```bash
npm install          # instala @supabase/ssr e @supabase/supabase-js
npm run build        # confirme que compila (não pôde ser rodado pelo Claude)
npm run dev
```
1. Abra `http://localhost:3000` → você cai em **/login** (não há mais conta demo).
2. Clique em **criar conta** (mesma caixa, agora com nome e username) → preencha → **criar conta**.
3. **Se "Confirm email" estiver ligado:** aparece o aviso azul "Conta criada! Enviamos um e-mail…". Abra o e-mail, clique no link → você volta logado em **/home**.
   **Se estiver desligado:** vai direto para **/home**.
4. Confira no Supabase:
   - **Authentication → Users:** o usuário aparece.
   - **Table Editor → profiles:** uma linha com seu `name` e `username` (criada pelo trigger).
5. **Atualize a página (F5):** continua logado.
6. Clique em **sair:** volta ao `/login`. Tente abrir `http://localhost:3000/home` → é redirecionado ao `/login`.
7. Entre de novo; teste também senha errada ("E-mail ou senha incorretos.") e e-mail já cadastrado.

**O que você verá como usuário novo** (esperado, pois o resto ainda é mock): Home com o feed fictício; amigos e "minhas comunidades" vazios; perfil com seu nome, bio vazia, e TECH/PARCEIRO/GEEK em **0%** (ainda sem avaliações — decisão D4).

## 6. Limitações conhecidas desta etapa
- **Username ocupado:** o trigger do banco evita falha de cadastro acrescentando um sufixo (`joao` → `joao_a1b2c`), mas o formulário **não avisa** antes, porque não existe consulta pública de disponibilidade (todas as tabelas exigem login). O username ainda não aparece em nenhuma tela. Solução futura: uma RPC de disponibilidade (precisaria de nova migração e de revisão de segurança).
- **Não há "esqueci a senha"** nem troca de e-mail/senha.
- **Postagens, curtidas, comentários, scraps etc. feitos por você não são salvos** (continuam só em memória até suas etapas).
- A conta de demonstração (Edgar) **não faz mais login**; ele continua existindo como usuário fictício nos mocks.
- Se faltar a linha em `profiles` para um usuário (ex.: criado antes do trigger), a página mostra um erro explicando a causa.

## 7. Problemas comuns
| Sintoma | Causa provável |
|---|---|
| Tela de erro "Variáveis do Supabase ausentes…" | `.env.local` ausente/errado, ou servidor não reiniciado |
| Cai em `/login?erro=confirmacao` ao clicar no e-mail | Redirect URL `…/auth/callback` não cadastrada, ou link expirado |
| "Database error saving new user" no cadastro | Trigger `on_auth_user_created` ausente/falhando (rode `supabase/verify.sql`, bloco 8) |
| Entra mas a página dá erro de perfil | Usuário sem linha em `profiles` (ver acima) |
| Redirecionamento em loop | Cookies bloqueados no navegador ou `Site URL` diferente do endereço usado |
