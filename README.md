# Dashboard Focus

Dashboard comercial da **Hub ON** para reuniões de panorama das equipes Focus. Consolida leads do Bitrix24 por mês de criação, equipe, fase do funil e corretor — sem abrir o CRM.

![Hub ON](public/hub-on-cor.png)

## Para quem é

Gestores comerciais, líderes de equipe e diretoria da Focus (imobiliário / vendas). O painel foi pensado para **projetor ou notebook**, com leitura rápida de volume, perdas e desempenho por corretor.

## Funcionalidades

- **Visão Geral** — KPIs do funil ativo, gráfico de chegada de leads por mês e distribuição por fase
- **Equipes Focus** — abas **Elite**, **Líder** e **Total** com detalhe por corretor
- **Liderança das equipes** — cards exibem nome e foto circular da líder, carregada do perfil no Bitrix
- **Filtro de período** — ano todo, mês atual, pico ou mês específico (por data de criação do lead)
- **Funil ativo vs. perdas** — Negócios Perdidos e Prazos Perdidos separados visualmente do funil ativo
- **Roster Focus** — corretores que saíram da equipe aparecem em cinza
- **Identidade visual fixa** — navbar roxa, fundo cinza-claro e cards em Liquid Glass
- **Dados Bitrix ou fallback local** — usa webhook quando configurado; caso contrário, exibe dados estáticos de demonstração
- **Proteção contra limite do Bitrix** — cache regional de 15 minutos, dados anteriores por até 6 horas e espera progressiva em respostas HTTP 429

## Stack

| Camada | Tecnologia |
|--------|------------|
| Framework | [TanStack Start](https://tanstack.com/start) + React 19 |
| Roteamento | TanStack Router (file-based) |
| Estilo | Tailwind CSS 4, shadcn/ui, Plus Jakarta Sans |
| Dados | Server Functions + API REST Bitrix24 (webhook) |
| Build / deploy | Vite 8, Nitro (preset Cloudflare Workers) |

## Pré-requisitos

- **Node.js** 20+ (ou Bun)
- Webhook de entrada do Bitrix24 com permissão para CRM (deals, usuários, departamentos, etapas)

## Instalação

```bash
git clone <url-do-repositorio>
cd sales-compass-visual-main
npm install
```

## Variáveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
BITRIX_WEBHOOK_URL=https://SEU_PORTAL.bitrix24.com.br/rest/1/SEU_CODIGO/
```

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `BITRIX_WEBHOOK_URL` | Não* | URL base do webhook Bitrix (com barra final opcional) |

\* Sem essa variável o app sobe normalmente, mas usa **dados locais** e exibe aviso no header.

> **Segurança:** nunca commite `.env` ou `.env.local`. O webhook dá acesso à API do Bitrix — trate como segredo.

## Desenvolvimento

```bash
npm run dev
```

Abra [http://localhost:8080](http://localhost:8080).

A **primeira carga com Bitrix** pode levar até ~1 minuto (consulta de deals, usuários e departamentos). Uma tela de carregamento é exibida nesse intervalo.
As cargas seguintes reutilizam o cache da Vercel para evitar consultas repetidas e bloqueios por excesso de requisições.

### Scripts úteis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção (`.output/`) |
| `npm run preview` | Preview do build local |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## Build e deploy

```bash
npm run build
```

O artefato fica em `.output/`. Com Nitro + Cloudflare:

```bash
npx nitro deploy --prebuilt
```

Configure `BITRIX_WEBHOOK_URL` no painel do provedor (Cloudflare Workers / variáveis de ambiente do deploy). O `vite.config.ts` já declara essa variável para o runtime Nitro.

Scripts alternativos no `package.json` apontam para Vercel (`vercel:deploy`, `vercel:prod`), se preferir esse fluxo.

## Integração Bitrix

O loader em `src/lib/fetch-dashboard.ts` orquestra:

1. Departamentos **Focus Elite**, **Focus Líder** e **Focus Total** (incluindo subdepartamentos)
2. Usuários vinculados a esses departamentos, incluindo `PERSONAL_PHOTO`
3. Deals do pipeline **Comercial Geral** (categoria `16`) criados em **2026**
4. Mapeamento de etapas → fases do funil (`src/lib/phases.ts`)

Regras de negócio importantes:

- Contagem por **mês de `DATE_CREATE`** do deal
- Mês sem leads fica **em branco** no gráfico (não inventa zeros)
- Apenas responsáveis dos três departamentos Focus entram no painel
- Perdas não entram no total do funil ativo
- Líderes definidas: **Marianna Queiroz Rosal** (Elite), **Rafaela Góes** (Líder) e **Carol Mello** (Total)
- A foto da líder vem do webhook; quando indisponível, o card exibe suas iniciais

## Estrutura do projeto

```
src/
├── routes/
│   ├── __root.tsx      # Shell HTML, meta, favicon
│   └── index.tsx       # Dashboard principal
├── lib/
│   ├── bitrix.ts       # Cliente REST Bitrix24
│   ├── bitrix-env.ts   # Resolução de BITRIX_WEBHOOK_URL
│   ├── fetch-dashboard.ts  # Server function do loader
│   ├── phases.ts       # Fases do funil e cores
│   └── teams-data.ts   # Equipes, roster e agregações
├── components/
│   └── ui/             # Componentes shadcn/ui
├── styles.css          # Design tokens e utilitários do dashboard
└── server.ts           # Wrapper SSR de erros

public/
└── hub-on-cor.png      # Logo e favicon

PRODUCT.md              # Contexto de produto e usuários
DESIGN.md               # Design system documentado
```

## Documentação adicional

- [PRODUCT.md](./PRODUCT.md) — propósito, público e princípios de produto
- [DESIGN.md](./DESIGN.md) — tokens, tipografia e padrões visuais

---

**Hub ON** · CRECI 1735-J/B
