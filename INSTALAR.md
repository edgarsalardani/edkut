# EdKut — Entrega 4: Home no estilo Orkut clássico

A página `/home` (botão "início") agora segue o mesmo visual do Perfil Clássico: 3 colunas, cartões brancos em fundo azul-claro,
mesmos indicadores (estrela, carinhas, cubinhos, corações), mesmo quadro de amigos e de comunidades.
**Sem migration nova** (usa as tabelas/colunas da migration 14) e **sem tabela nova**. Nada foi aplicado no seu Supabase; sem commit/push.

## 1. Pré-requisitos
Migrations 1–14 aplicadas (a 14 é a do perfil clássico). Sem ela a Home ainda abre, mas mostra um aviso e os contadores de fotos/vídeos/fãs ficam em "–".

## 2. Instalação
Faça backup/branch e copie o conteúdo do ZIP sobre a raiz do projeto, mantendo as pastas. Não há comando extra (`npm run dev` / deploy normal).

## 3. Arquivos
**Novos (2):**
- `src/components/HomeClassicView.tsx` — Home (apresentação; só mostra dados reais recebidos da página)
- `src/services/homeService.ts` — últimos recados recebidos, solicitações de amizade pendentes e depoimentos aguardando aprovação

**Substituídos (7):**
- `src/app/home/page.tsx` — passa a usar a nova Home (o quadro antigo de "novidades" foi removido; `ProfileCard` deixou de ser usado aqui, mas o arquivo continua no projeto)
- `src/services/profileClassicService.ts` — acrescenta `getProfileSummary` (versão leve, sem fotos/vídeos); o restante é idêntico
- `src/lib/profileClassic.ts` — acrescenta `parseInitialTab` e o tipo `ProfileTab` no final
- `src/components/ClassicIndicators.tsx` — nova propriedade opcional `stacked` (um indicador por linha); o perfil não muda
- `src/app/profile/[id]/page.tsx` e `src/components/ProfilePageClient.tsx` — o perfil agora aceita `?aba=fotos|videos|recados|depoimentos` (usado pelos atalhos Fotos/Vídeos do menu da Home)
- `src/components/ProfileStatusEditor.tsx` — correção (ver abaixo)

> Alterações no perfil, só estas duas: (1) abas por URL; (2) **correção de bug do meu código anterior**: um status de 100 caracteres sem espaços (ou nome enorme) alargava a página no celular, gerando rolagem horizontal. Corrigido no perfil (`ProfilePageClient`, `ProfileStatusEditor`) e já nasce corrigido na Home.

## 4. O que a Home mostra (tudo real)
- **Esquerda:** foto, nome, tipo (Estudante/Professor…), frase de status do perfil, indicadores clássicos (os mesmos do perfil — nenhum percentual NERD/PARCEIRO/TECH) e menu vertical: perfil, recados (→ `/scraps`), fotos e vídeos (→ abas do perfil), depoimentos (→ `/testimonials`), amigos (→ `/friends`), comunidades (→ `/communities`), com contadores.
- **Centro:** saudação; atalhos (recados, depoimentos aguardando aprovação, solicitações de amizade pendentes — destacados em rosa quando há pendência —, comunidades, encontrar pessoas); solicitações de amizade pendentes (até 3); últimos 3 recados recebidos; e um aviso discreto de que as publicações dos amigos ainda não existem (nenhuma publicação fictícia).
- **Direita:** os mesmos quadros do perfil — amigos (foto, nome, total, "ver todos") e comunidades (imagem, nome, total, "ver todas").
- **Menu superior:** inalterado (início, perfil, amigos, comunidades, scraps, depoimentos). Login/redirecionamentos: inalterados.
- **Celular:** colunas empilhadas (identidade → centro → conexões); o menu vira grade de 2–3 colunas; sem rolagem horizontal.

## 5. Checklist de testes manuais (conta A com amigos, comunidades, recados; conta B para pedir amizade/deixar recado)
1. Login → cai em `/home` com 3 colunas no desktop; clicar em "início" no topo leva à mesma Home.
2. Esquerda: foto, nome, tipo, status **igual** ao do perfil (edite o status no perfil e recarregue a Home); indicadores iguais aos do perfil, sem percentuais; sem status → link "escreva uma frase de status".
3. Menu lateral: perfil; recados → `/scraps`; fotos/vídeos → perfil já na aba certa; depoimentos → `/testimonials`; amigos → `/friends`; comunidades → `/communities`. Contadores conferem.
4. B envia solicitação de amizade a A → na Home de A: atalho e quadro "solicitações de amizade" com B; "aceitar ou recusar" abre `/friends`.
5. B deixa um recado (precisa ser amigo) e um depoimento → Home de A: recado em "últimos recados"; depoimento pendente destaca o atalho e o menu ("N novos"). Aprovar o depoimento zera o destaque.
6. Direita: amigos e comunidades reais, miniaturas e nomes clicáveis, "ver todos"/"ver todas". Conta sem amigos/comunidades mostra mensagens vazias com link.
7. Não existe mais o quadro "novidades"; o aviso do feed é pequeno.
8. Celular (≈390 px): nada sobreposto nem cortado; sem rolagem horizontal; menu acessível.
9. Perfil, scraps/respostas, depoimentos, fotos, vídeos e comunidades continuam como antes; `?aba=fotos` no perfil abre a galeria.

## 6. Testes executados — e limites
**Executado (ambiente local):**
- Home no Chromium (Playwright, 45 verificações) com dados **simulados**: 3 colunas e larguras idênticas às do perfil (190/flex/250), empilhamento em 360/390/768 px sem rolagem horizontal, menu e destinos dos links, indicadores iguais aos do perfil, atalhos e pendências, recados com emoticon, autor desconhecido, estados vazios, aviso sem a migration 14, nome/status longos.
- Perfil (103 verificações) e Comunidades no Chromium, lógica do perfil (60) e `parseInitialTab` — todos passando após as mudanças. Checagem de tipos TypeScript com stubs.
- Não houve mudança de SQL nesta entrega (a regressão SQL da entrega 3 continua valendo).

**NÃO verificado:** `npm run build`/lint do seu projeto; Supabase real (Auth, PostgREST, RLS via API) — as consultas novas da Home (últimos recados, depoimentos pendentes, solicitações) usam as mesmas tabelas/regras já existentes, mas rodaram aqui só com cliente simulado; CSS compilado com Tailwind v4 (aproximação do seu build).

## 7. Fora desta entrega
Feed de publicações dos amigos, fórum das comunidades (migrations 15+), documentação LaTeX.
