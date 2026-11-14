# "Esqueci minha senha" — recuperação de senha com Supabase Auth

> **Status:** implementado, **mas `npm run build` e o fluxo real (e-mail → link → nova senha) NÃO foram executados** pelo Claude (sem acesso à internet/Supabase no ambiente dele). Veja o checklist da seção 5 e rode-o no seu computador.

## 1. Como funciona (PKCE, só mecanismos oficiais do Supabase)

```
/login ──"Esqueceu sua senha?"──► /forgot-password
   resetPasswordForEmail(email, redirectTo = <origem>/auth/callback?next=/auth/reset-password)
   ► mensagem fixa: "Se este e-mail estiver cadastrado, você receberá um link..."
E-mail ──link──► Supabase /verify ──► /auth/callback?code=...&next=/auth/reset-password
   exchangeCodeForSession(code)  (sessão de recuperação em cookies)
   ► /auth/reset-password  ──updateUser({ password })──► signOut(global) ──► "Ir para o login"
```
- Link inválido/expirado/já usado: o callback manda para `/forgot-password?erro=link`; se a tela de nova senha for aberta sem sessão válida, ela mostra "Link inválido ou expirado" com botão para pedir outro.
- Nunca se revela se o e-mail existe: a tela mostra sempre a mesma mensagem. Só aparecem erros de limite de envios e de rede.
- Após trocar a senha, todas as sessões são encerradas (`signOut` scope `global`): a senha antiga e sessões antigas deixam de valer.
- Segurança: nenhuma chave `service_role`; nenhum token é lido/logado/guardado; a senha só trafega para o Supabase (nada em tabelas, cookies próprios ou localStorage); sem migrações SQL; RLS intocado.
- `next` do callback só aceita `/home` e `/auth/reset-password` (lista fixa → sem open redirect).

## 2. Arquivos

**Novos**
```
src/app/forgot-password/page.tsx         pedido do link (e-mail, loading, espera de 60 s p/ reenviar)
src/app/auth/reset-password/page.tsx     nova senha + confirmação, estados: verificando / inválido / pronto / concluído
src/components/AuthShell.tsx             moldura visual (logo + painel) e caixas de aviso/erro
src/lib/authRedirect.ts                  lista fixa de destinos do `next`
docs/supabase/RECUPERACAO_SENHA.md       este guia
```
**Modificados**
```
src/lib/session.ts                       + requestPasswordReset, hasValidSession, updatePassword, signOutEverywhere (o que já existia não mudou)
src/app/auth/callback/route.ts           + parâmetro `next` validado; erro de recuperação -> /forgot-password?erro=link;
                                           + (opcional) ?token_hash=...&type=recovery via verifyOtp
src/lib/supabase/middleware.ts           PUBLIC_PATHS: + /forgot-password e /auth/reset-password (só isso)
src/app/login/page.tsx                   + link "Esqueceu sua senha?" (só no modo "entrar"); nada mais mudou
```

## 3. Configurar o painel do Supabase

**Authentication → URL Configuration**
- **Site URL:** `http://localhost:3000` (em produção: a URL do site). É o endereço usado como base quando o `redirectTo` não é aceito.
- **Redirect URLs** (lista de permissão): adicione
  - `http://localhost:3000/auth/callback`
  - `https://SEU-DOMINIO/auth/callback` (produção)
  
  Se o painel recusar o redirecionamento por causa do `?next=...`, use curinga: `http://localhost:3000/**` (e `https://SEU-DOMINIO/**`). Se o `redirectTo` não estiver na lista, o Supabase ignora e manda para o Site URL — o sintoma é cair na página inicial em vez da tela de nova senha.

**Authentication → Emails → Templates → "Reset Password"**
- O modelo padrão (`<a href="{{ .ConfirmationURL }}">Reset Password</a>`) funciona com este código. Pode traduzir o texto para português; **mantenha** `{{ .ConfirmationURL }}`.
- *Limitação do PKCE:* o link só funciona no **mesmo navegador** em que o pedido foi feito (o "code verifier" fica num cookie dele). Para funcionar em qualquer aparelho, troque o link do modelo por
  `<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset-password">Redefinir senha</a>`
  (o callback já aceita esse formato). Opcional.

**Authentication → Providers → Email / Sign In / Providers → política de senha**
- A senha mínima e as exigências de caracteres vêm daqui; o app exige ≥ 8 e mostra a mensagem do Supabase quando a política for mais rígida.

**E-mails:** o servidor de e-mail embutido tem limite baixo de envios por hora (e limite de ~1 envio/minuto por endereço). Para uso real configure um **SMTP próprio** (Project Settings → Authentication → SMTP).

## 4. Pontos de atenção
- Quem tem a sessão aberta pelo link e clica "Cancelar" tem a sessão local encerrada; se fechar a aba sem concluir, continuará logado até sair (é o comportamento padrão do Supabase para recuperação).
- Se o e-mail do usuário ainda não foi confirmado, o Supabase pode não enviar o link de recuperação; o app não indica isso (para não revelar nada).

## 5. Checklist de teste (NÃO executado pelo Claude — faça no seu ambiente)
1. `npm install && npm run build` (sem erros) e `npm run dev`.
2. Deslogado: `/login` mostra "Esqueceu sua senha?" → abre `/forgot-password`.
3. Pedir link com e-mail **cadastrado** e com e-mail **inexistente**: a mensagem exibida deve ser idêntica.
4. Abrir o link do e-mail (mesmo navegador) → cai em `/auth/reset-password` com o formulário.
5. Senha curta (<8) e confirmação diferente → erros em português. Senha igual à atual → erro.
6. Senha válida → "Senha redefinida" → `/login`: **a senha nova entra; a antiga é recusada**.
7. Reabrir o mesmo link → "Link inválido ou expirado". Esperar expirar (ou usar link antigo) → idem.
8. Abrir `/auth/reset-password` direto, deslogado → "Link inválido ou expirado".
9. Com sessão ativa em outra aba: pedir/abrir o link → funciona (a sessão passa a ser a do usuário do link).
10. Regressão: cadastro, confirmação de e-mail, login, logout e rotas protegidas continuam como antes.
