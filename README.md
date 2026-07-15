# Dashboard Focus

Dashboard comercial da **Hub ON** para reuniões de panorama das equipes Focus. Consolida leads do Bitrix24 por mês de criação, equipe, fase do funil e corretor — sem abrir o CRM.

![Hub ON](public/hub-on-cor.png)

## Para quem é

Gestores comerciais, líderes de equipe e diretoria da Focus (imobiliário / vendas). O painel foi pensado para **projetor ou notebook**, com leitura rápida de volume, perdas e desempenho por corretor.

## Funcionalidades

### Dashboard

- **Visão Geral** — KPIs do funil ativo, gráfico de chegada de leads por mês e distribuição por fase
- **Duas esteiras Bitrix** — **Comercial Geral** (categoria 16) e **Econômico** (categoria 64), com alternância no header para perfis autorizados
- **Equipes por esteira**
  - *Comercial Geral:* Focus Elite, Focus Líder, Focus Total
  - *Econômico:* Focus Elite, subequipes de **Focus Primeira Chave** (Imparáveis, Domina, Legado, Lobos) e Focus Total
- **Liderança das equipes** — cards exibem nome e foto circular da líder, carregada do perfil no Bitrix
- **Filtro de período** — ano todo, mês atual, pico ou mês específico (por data de criação do lead)
- **Funil ativo vs. perdas** — Negócios Perdidos e Prazos Perdidos separados visualmente do funil ativo
- **Status do atendimento** — quarentena e standby do campo customizado Bitrix
- **Roster Focus** — corretores que saíram da equipe aparecem em cinza
- **Identidade visual fixa** — navbar roxa, fundo cinza-claro e cards em Liquid Glass
- **Dados Bitrix ou fallback local** — usa webhook quando configurado; caso contrário, exibe dados estáticos de demonstração
- **Proteção contra limite do Bitrix** — cache regional de 15 minutos, dados anteriores por até 6 horas e espera progressiva em respostas HTTP 429

### Autenticação e acesso

- **Login** via Supabase Auth (e-mail e senha)
- **Papéis:** Superintendente, Administrador, Diretor e Líder
- **Gestão de acesso** (administradores) — criar, editar e excluir usuários; definir visão, páginas e esteira por pessoa
- **Esteira por usuário:** Comercial Geral, Econômico ou **Ambas as esteiras**
- **Alternância de esteira** no dashboard para Superintendente, Administrador e usuários com acesso às duas esteiras

## Stack

| Camada | Tecnologia |
|--------|------------|
| Framework | [TanStack Start](https://tanstack.com/start) + React 19 |
| Roteamento | TanStack Router (file-based) |
| Estilo | Tailwind CSS 4, shadcn/ui, Plus Jakarta Sans |
| Auth / acesso | Supabase Auth + Postgres (RLS) |
| Dados | Server Functions + API REST Bitrix24 (webhook) |
| Build / deploy | Vite 8, Vercel (Nitro) |

## Pré-requisitos

- **Node.js** 20+ (ou Bun)
- Projeto **Supabase** com migrations aplicadas (ver abaixo)
- Webhook de entrada do Bitrix24 com permissão para CRM (deals, usuários, departamentos, etapas)

## Instalação

```bash
git clone https://github.com/Hub-On-Tecnologia/dashboard-comercial-focus.git
cd dashboard-comercial-focus
npm install
```

## Variáveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
# Bitrix
BITRIX_WEBHOOK_URL=https://SEU_PORTAL.bitrix24.com.br/rest/1/SEU_CODIGO/

# Supabase (login e gestão de acesso)
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon

# Servidor (criação de usuários pelo admin — não expor no cliente)
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key

# E-mails com bootstrap de administrador (opcional, separados por vírgula)
VITE_ADMIN_EMAILS=admin@empresa.com
```

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `BITRIX_WEBHOOK_URL` | Não* | URL base do webhook Bitrix |
| `VITE_SUPABASE_URL` | Sim** | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Sim** | Chave anon/public do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim† | Service role para criar usuários no Auth (server only) |
| `VITE_ADMIN_EMAILS` | Não | E-mails extras com perfil administrador no bootstrap |

\* Sem `BITRIX_WEBHOOK_URL` o app sobe com **dados locais** de demonstração.

\** Necessário para login e controle de acesso.

† Necessário para a tela de **Gestão de acesso** criar contas.

> **Segurança:** nunca commite `.env` ou `.env.local`. Webhook e service role dão acesso amplo — trate como segredo.

### Sincronizar env com a Vercel

```bash
npm run vercel:env:pull
npm run vercel:supabase:sync
```

## Banco de dados (Supabase)

As migrations ficam em `supabase/migrations/`. Para aplicar no SQL Editor do Supabase:

```bash
node scripts/print-access-migration.mjs
```

Ordem dos arquivos:

1. `20260715103000_access_control.sql` — papéis, perfis e páginas
2. `20260715120000_dashboard_pipelines.sql` — esteiras e coluna `pipeline_key`
3. `20260715130000_pipeline_access_ambas.sql` — opção “Ambas as esteiras”

Validar após aplicar:

```bash
node scripts/verify-access-setup.mjs seu@email.com
```

Configurar service role localmente:

```bash
npm run supabase:service-role -- SUA_SERVICE_ROLE_KEY
```

## Desenvolvimento

```bash
npm run dev
```

Abra [http://localhost:8080](http://localhost:8080).

A **primeira carga com Bitrix** pode levar até ~1 minuto (consulta de deals, usuários e departamentos). Uma tela de carregamento é exibida nesse intervalo. As cargas seguintes reutilizam cache para evitar bloqueios por excesso de requisições.

### Scripts úteis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run preview` | Preview do build local |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run vercel:prod` | Deploy de produção na Vercel |
| `node scripts/print-access-migration.mjs` | Imprime SQL das migrations de acesso |
| `node scripts/verify-access-setup.mjs <email>` | Valida tabelas e perfil no Supabase |

## Build e deploy

```bash
npm run build
npm run vercel:prod
```

Configure no painel da Vercel (ou via `vercel env`):

- `BITRIX_WEBHOOK_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_ADMIN_EMAILS` (opcional)

O `vite.config.ts` declara essas variáveis para o runtime do servidor.

## Integração Bitrix

O loader em `src/lib/fetch-dashboard.server.ts` orquestra, por esteira:

1. Departamentos das equipes Focus (incluindo subdepartamentos de **Focus Primeira Chave** na esteira Econômico)
2. Usuários vinculados a esses departamentos, incluindo `PERSONAL_PHOTO`
3. Deals do pipeline da esteira ativa, criados em **2026**
4. Mapeamento de etapas → fases do funil (`src/lib/phases.ts`)

Regras de negócio importantes:

- Contagem por **mês de `DATE_CREATE`** do deal
- Mês sem leads fica **em branco** no gráfico (não inventa zeros)
- Perdas não entram no total do funil ativo
- Líderes definidas: **Marianna Queiroz Rosal** (Elite), **Rafaela Góes** (Líder) e **Carol Mello** (Total)
- A foto da líder vem do webhook; quando indisponível, o card exibe suas iniciais

## Estrutura do projeto

```
src/
├── routes/
│   ├── __root.tsx              # Shell HTML, meta, favicon
│   └── index.tsx               # Dashboard + alternância de esteiras
├── lib/
│   ├── access-control.ts       # Papéis, páginas, esteiras e regras
│   ├── access.tsx              # Provider de permissões (cliente)
│   ├── auth.tsx                # Sessão Supabase
│   ├── bitrix.ts               # Cliente REST Bitrix24
│   ├── fetch-dashboard.server.ts
│   ├── create-user-access.server.ts
│   └── teams-data.ts           # Equipes, roster e agregações
├── components/
│   ├── login-screen.tsx
│   ├── access-management-screen.tsx
│   └── ui/                     # Componentes shadcn/ui
├── styles.css
supabase/migrations/            # SQL de auth e controle de acesso
scripts/                        # Utilitários de setup e verificação
public/
└── hub-on-cor.png
```

## Documentação adicional

- [PRODUCT.md](./PRODUCT.md) — propósito, público e princípios de produto
- [DESIGN.md](./DESIGN.md) — tokens, tipografia e padrões visuais

---

**Hub ON** · CRECI 1735-J/B
