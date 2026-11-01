# Pendências de segurança — auditar ANTES do lançamento público

**Decisão registrada:** os avisos do Security Advisor sobre funções `SECURITY DEFINER` (previstos na arquitetura) **não bloqueiam o desenvolvimento**; ficam como pendência obrigatória antes de abrir o cadastro ao público.

## P1 — 4 avisos do Security Advisor (funções `SECURITY DEFINER`)

> Não tive acesso à tela do Advisor; pelo desenho das migrações, os quatro avisos devem corresponder às únicas funções `SECURITY DEFINER` com `EXECUTE` concedido ao role `authenticated` (acessíveis pela API como RPC). **Confirme os nomes na tela e corrija esta lista se divergir.**

| Função (migração) | Por que é `SECURITY DEFINER` | O que auditar |
|---|---|---|
| `accept_friend_request(uuid)` (0003) | cria a amizade, que o cliente não pode inserir | só o **destinatário** aceita; só `pending`; trava `FOR UPDATE`; resposta não vaza dados |
| `decline_friend_request(uuid)` (0003) | muda status sem UPDATE direto | só o destinatário; só `pending` |
| `cancel_friend_request(uuid)` (0003) | idem | só o remetente; só `pending` |
| `is_community_moderator(uuid)` (0004) | evita recursão de RLS em `community_members` | só responde sobre `auth.uid()`; sem parâmetro de usuário; sem vazamento |

**Checklist da auditoria (cada função):**
1. Valida `auth.uid()` (não-nulo) e a relação do chamador com o registro.
2. `SET search_path = ''` e objetos totalmente qualificados (já aplicado — reconferir).
3. `EXECUTE` revogado de `public` e `anon`; concedido só a `authenticated` (verify.sql, bloco 4).
4. Mensagens de erro sem detalhes internos.
5. Teste negativo: outro usuário tentando agir sobre solicitações/comunidades alheias.
6. Decidir se o aviso é aceito (funciona por desenho) ou mitigado — opções: manter e documentar a aceitação; mover a lógica para schema não exposto e expor um *wrapper* mínimo; ou trocar por `SECURITY INVOKER` + policies onde possível (viável para `is_community_moderator` com ajuste de policies).

Executar também o teste de fumaça (`supabase/tests/rls_smoke_test.sql`) em projeto de desenvolvimento antes do lançamento.

## P2 — Outros itens a fechar antes do lançamento
| # | Item | Estado |
|---|---|---|
| P2.1 | **"Confirm email" ligado** e SMTP próprio configurado (hoje, para testes, pode estar desligado) | pendente |
| P2.2 | Política de senha (comprimento/vazadas) revisada no painel do Auth | pendente |
| P2.3 | **Rate limiting** (Auth e RPCs): reenvio de solicitações de amizade, scraps, cadastros em massa | pendente |
| P2.4 | Disponibilidade de username sem expor lista de usuários (RPC com revisão de segurança) | pendente |
| P2.5 | Usernames reservados (D12) e perfil de conta não confirmada visível (D13) | decisão pendente |
| P2.6 | `user_type` autodeclarado (D7) | decisão pendente |
| P2.7 | Decisão D4 (cálculo TECH/PARCEIRO/GEEK) | decisão pendente |
| P2.8 | Backup/restauração e plano do projeto (limites do plano gratuito, pausa por inatividade) | pendente |
| P2.9 | Revisão final: chaves (`service_role` fora do app e do Git), CORS/URLs de redirecionamento de produção | pendente |
