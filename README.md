# edkut

> conectando quem aprende, ensina e compartilha tecnologia

Protótipo funcional de front-end do **edkut**, uma rede social acadêmica e
tecnológica inspirada na experiência social do antigo Orkut - com identidade
visual, marca e funcionalidades **próprias e originais** - voltada para
estudantes, professores, pesquisadores, egressos e profissionais de
Computação e Tecnologia.

Esta é a **V1**: um protótipo de frontend completo, com dados mockados e
arquitetura já preparada para receber um backend real no futuro (API,
autenticação, banco de dados, upload de imagens).

Projeto está constante evolução.

---

## Stack

- [Next.js 14](https://nextjs.org/) (App Router)
- React 18 + TypeScript
- Tailwind CSS (paleta e tipografia customizadas para a identidade nostálgica do edkut)

Sem backend, sem serviços pagos e sem dependências além do estritamente
necessário para rodar um app Next.js com Tailwind.

---

## Como executar localmente

Pré-requisitos: **Node.js 18.18+** (recomendado 20 ou 22) e npm.

```bash
# 1. instalar dependências
npm install

# 2. rodar em modo de desenvolvimento
npm run dev

# 3. abrir no navegador
# http://localhost:3000
```

A rota inicial (`/`) redireciona para `/login`. A tela de login é mockada:
qualquer clique em **"entrar"** leva direto para `/home` autenticado como o
usuário de demonstração, **Edgar Salardani** (professor e pesquisador).

Outros comandos disponíveis:

```bash
npm run build   # build de produção
npm run start   # roda o build de produção
npm run lint    # lint com as regras do Next.js
```


## Estrutura do projeto

```
edkut/
├── src/
│   ├── app/                  # rotas (Next.js App Router)
│   │   ├── layout.tsx        # layout raiz (html/body, metadata, globals.css)
│   │   ├── page.tsx          # "/" -> redireciona para /login
│   │   ├── login/
│   │   ├── home/
│   │   ├── profile/[id]/
│   │   ├── friends/
│   │   ├── communities/
│   │   │   └── [id]/
│   │   ├── scraps/
│   │   ├── testimonials/
│   │   ├── search/
│   │   ├── notifications/
│   │   └── globals.css       # estilos base + classes utilitárias (.edkut-card, .edkut-btn, ...)
│   │
│   ├── components/           # componentes reutilizáveis (ver lista abaixo)
│   ├── types/                # index.ts — contrato de dados de todo o app
│   ├── mocks/                 # dados de demonstração (usuários, posts, comunidades...)
│   ├── services/              # camada "de API" (hoje lê dos mocks, ver seção abaixo)
│   └── lib/                   # helpers (sessão mockada, formatação de datas, labels)
│
├── tailwind.config.ts         # paleta de cores e tipografia da identidade edkut
├── next.config.mjs
└── package.json
```

### Rotas implementadas

| Rota                    | Descrição                                              |
| ------------------------ | ------------------------------------------------------- |
| `/login`                  | Tela de entrada, com a identidade nostálgica do edkut   |
| `/home`                   | Feed cronológico + coluna de perfil + amigos/comunidades |
| `/profile/[id]`           | Perfil completo: bio, interesses, Tech·Parceiro·Geek, amigos, comunidades, publicações, scraps e depoimentos |
| `/friends`                | Lista de amigos, busca e solicitações pendentes          |
| `/communities`            | Diretório de comunidades: busca, categorias, abas (minhas/descobrir/populares), criar comunidade |
| `/communities/[id]`       | Página de uma comunidade: descrição, membros, moderadores, publicações |
| `/scraps`                 | Scraps recebidos pelo usuário logado                     |
| `/testimonials`           | Depoimentos recebidos pelo usuário logado                |
| `/search`                 | Busca global (pessoas, comunidades e publicações)         |
| `/notifications`          | Notificações internas                                    |

A navegação entre todas as rotas é feita com `next/link` a partir do
`Header` (presente em todas as páginas autenticadas via `AppShell`) e de
links contextuais dentro de cada página (ex: avatar de um autor de post leva
ao perfil dele, card de comunidade leva à página da comunidade, etc).

### Principais componentes (`src/components`)

- **`AppShell`** — casca compartilhada de todas as páginas autenticadas: busca o usuário atual e as notificações, renderiza o `Header` e o container de conteúdo.
- **`Header`** — barra superior com logo, navegação (início · perfil · amigos · comunidades · scraps · depoimentos), busca e sessão (Olá, Nome · sair).
- **`Logo`** — logotipo textual original do edkut.
- **`Avatar`** (+ `UserAvatar`, `CommunityAvatar`) — "foto" leve baseada em emoji + cor, sem depender de imagens externas ou de terceiros.
- **`ProfileCard`** — card compacto de perfil usado nas barras laterais.
- **`TechProfileIndicators`** — os indicadores sociais TECH · PARCEIRO · GEEK.
- **`FriendGrid`** / **`FriendRequestCard`** / **`AddFriendButton`** — amigos e solicitações.
- **`CommunityGrid`** / **`CommunityHeader`** — listagem e cabeçalho de comunidades.
- **`PostFeed`** / **`PostCard`** / **`CreatePostBox`** / **`Comment`** — feed, publicações e comentários (curtir, comentar, publicar).
- **`ScrapCard`** / **`ProfileScrapsSection`** — scraps (recados públicos de perfil).
- **`TestimonialCard`** / **`ProfileTestimonialsSection`** — depoimentos.
- **`NotificationList`** — lista de notificações internas.
- **`Search`** (`SearchBar`) — busca reutilizada no header e na página `/search`.
- **`Tag`** — pill de interesse/tecnologia.

---

## Dados mockados (`src/mocks`)

Todo o conteúdo de demonstração vive em `src/mocks`, um arquivo por
entidade:

Nenhum dado pertence a pessoas reais.

---

## Camada de services (`src/services`) - preparada para uma API real

Os componentes **nunca** importam os mocks diretamente para buscar listas de
dados — eles chamam funções de `src/services/*`, que hoje leem dos mocks
mas já retornam `Promise`, exatamente como uma chamada de API real faria:

```ts
// hoje (mock):
export async function getFeedPosts(): Promise<Post[]> {
  return simulateDelay(sortByDateDesc(posts));
}

// amanhã (API real) - mesma assinatura, os componentes não mudam:
export async function getFeedPosts(): Promise<Post[]> {
  const res = await fetch("/api/posts");
  return res.json();
}
```

## Escopo desta V1

Implementado: identidade visual nostálgica, login mockado, feed cronológico
(sem algoritmo de recomendação), perfil completo com Tech · Parceiro ·
Geek, amigos (com solicitações), comunidades (busca, categorias, criar,
entrar/sair, publicações dentro da comunidade), scraps, depoimentos, busca
global e notificações internas — tudo navegável e com dados mockados
suficientes para a rede social parecer "viva".

Fora do escopo da V1 (por decisão da especificação): notas, atividades
avaliativas, frequência ou qualquer mecanismo de sala de aula; algoritmo de
recomendação no feed; aprovação/rejeição de depoimentos; backend, banco de
dados ou autenticação reais; upload de imagens.
