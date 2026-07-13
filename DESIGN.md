---
name: Sales Compass Visual — Focus
description: Dashboard comercial Focus — funil, equipes e corretores a partir do Bitrix.
colors:
  canvas: "oklch(0.12 0.04 300)"
  surface: "oklch(0.16 0.045 298)"
  surface-glass: "oklch(0.18 0.042 298 / 0.48)"
  ink: "oklch(0.98 0.005 250)"
  ink-muted: "oklch(0.70 0.02 260)"
  ink-faint: "oklch(0.55 0.02 260)"
  border-subtle: "oklch(1 0 0 / 0.1)"
  border-glass: "oklch(1 0 0 / 0.15)"
  accent-elite-from: "#7c3aed"
  accent-elite-to: "#c084fc"
  accent-lider-from: "#10b981"
  accent-lider-to: "#14b8a6"
  accent-total-from: "#f59e0b"
  accent-total-to: "#f97316"
  tab-overview-from: "#f1f5f9"
  tab-overview-to: "#cbd5e1"
  phase-tentativa: "#14b8a6"
  phase-agendados: "#7c3aed"
  phase-realizados: "#2563eb"
  phase-em-atendimento: "#f59e0b"
  phase-propostas: "#06b6d4"
  phase-contratos: "#10b981"
  phase-negocios-perdidos: "#ef4444"
  phase-prazos-perdidos: "#f97316"
  loss-zone-bg: "oklch(0.18 0.04 20 / 0.15)"
  loss-zone-border: "oklch(0.35 0.08 20 / 0.5)"
typography:
  display:
    fontFamily: "\"Plus Jakarta Sans\", ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 3vw, 1.875rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  metric:
    fontFamily: "\"Plus Jakarta Sans\", ui-sans-serif, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
  body:
    fontFamily: "\"Plus Jakarta Sans\", ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "\"Plus Jakarta Sans\", ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.15em"
  table:
    fontFamily: "\"Plus Jakarta Sans\", ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: "0.375rem"
  md: "0.625rem"
  lg: "0.75rem"
  xl: "1rem"
  pill: "9999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.25rem"
  panel: "1rem"
components:
  tab-active:
    textColor: "{colors.canvas}"
    rounded: "{rounded.pill}"
    padding: "0.375rem 1rem"
  tab-inactive:
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.pill}"
    padding: "0.375rem 1rem"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "{spacing.panel}"
  panel-glass:
    backgroundColor: "{colors.surface-glass}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "{spacing.panel}"
  filter-trigger:
    backgroundColor: "oklch(0.205 0.025 265 / 0.6)"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 0.875rem"
  filter-apply:
    backgroundColor: "{colors.tab-overview-from}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.lg}"
    padding: "0.625rem 1rem"
---

# Design System: Sales Compass Visual — Focus

## Overview

**Creative North Star: "War Room Comercial"**

Superfície escura de reunião — densidade alta, contraste forte, cor só onde o dado exige (fase, equipe, perda). A UI serve o ritual semanal de panorama Focus: filtrar mês, comparar equipes, ler funil ativo vs perdas, inspecionar corretor por etapa.

Tipografia **Plus Jakarta Sans** em todo o dashboard (400–700), métricas com `tabular-nums`, painéis com borda sutil. Motion intencional: entrada escalonada de KPIs, barras que preenchem, abas com pill deslizante, transição suave entre Visão Geral e equipes — sempre com fallback em `prefers-reduced-motion`.

**Key Characteristics:**

- Dados antes de decoração; tabela densa para corretores
- Funil ativo e perdas sempre separados visualmente
- Cor de equipe/fase com significado semântico fixo
- Liquid glass controlado nos cards de dados; filtros e tabela interna permanecem sóbrios
- Filtro de período em painel lateral (Sheet), não pills espalhadas

Anti-referências herdadas de PRODUCT.md: CRM roxo/indigo genérico, neon glow, grids de cards idênticos, eyebrows uppercase em toda seção, hero-metric template.

## Colors

Canvas slate quase-preto (`canvas` / `surface`) com tinta clara. Neutros carregam ~85% da UI.

### Primary (equipes)

- **Focus Elite Violet** (`#7c3aed` → `#c084fc`): aba ativa, pill deslizante, filete do card equipe.
- **Focus Líder Emerald** (`#10b981` → `#14b8a6`): idem.
- **Focus Total Amber** (`#f59e0b` → `#f97316`): idem.

### Neutral

- **Deep Slate Canvas** (`oklch(0.145 0.02 264)`): fundo de página (gradiente `slate-950` → `slate-900`).
- **Panel Surface** (`oklch(0.205 0.025 265 / 0.6)`): cards padrão, borda `slate-800`.
- **Glass Surface** (`oklch(0.205 0.025 265 / 0.45)` + borda `white/15` + `backdrop-blur-xl`): exclusivo dos 4 KPIs topo.
- **Ink / Muted / Faint**: texto principal, secundário, placeholders e células vazias (`—`).

### Tertiary (fases do funil)

Vocabulário fixo em `phase-*` (teal, indigo, sky, amber, violet, emerald). Perdas: `phase-negocios-perdidos` (#ef4444), `phase-prazos-perdidos` (#f97316).

**The Loss Zone Rule.** Coluna "Neg. perd." na tabela usa caixa própria (`border-x` vermelho escuro + fundo `red-950/15`); Prazos e Ativo ficam fora. Perdas nunca entram na mesma barra empilhada do funil ativo.

**The Liquid Glass Rule.** Cards de dados usam superfície translúcida, blur e brilho interno discreto. O efeito não usa glow externo, não reduz contraste e não se aplica aos controles nem ao interior da tabela.

## Typography

**Display / Body / Label Font:** Plus Jakarta Sans (400, 500, 600, 700) com fallback `ui-sans-serif, system-ui, sans-serif`.

**Character:** geométrica-humanista, legível em projeção, números tabulares nativos.

### Hierarchy

- **Display** (700, `text-2xl`/`text-3xl`, tracking ≥ −0.04em): título "Dashboard das Equipes Focus".
- **Metric** (700, `text-4xl`/`text-5xl`, `tabular-nums`): funil ativo, KPI equipe, totais animados.
- **Title** (600, `text-sm`): títulos de painel ("Chegada de leads", "Distribuição por fase").
- **Body** (400–500, `text-xs`/`text-sm`): legendas, subtítulos, células de tabela.
- **Label** (600, `text-[10px]`, uppercase, tracking largo): chrome de filtro e seções "Funil ativo" / "Perdas" — uso escasso, nunca em todo painel.

**The Tabular Rule.** Todo número comparável usa `tabular-nums` (KPIs, tabela, legendas de fase).

## Elevation

Quase flat por padrão. Painéis: `border` 1px + fundo opaco, **sem** box-shadow amplo (proibido par border + shadow difusa).

Profundidade por tom e borda, não por lift. Exceções:

- **Liquid glass card**: brilho interno sutil + blur e refração violeta — sem sombra externa.
- **Hover KPI**: leve `translateY(-0.5)` — feedback tátil mínimo.

Gradiente de página é atmosfera de fundo, não card flutuante.

## Components

### Navigation (TeamTabNav)

- **Barra:** roxo escuro em largura total; conteúdo alinhado ao grid de 1600px.
- **Abas:** pills brancas, texto quase-preto, altura 36px e espaçamento de 6px.
- **Ativa:** sublinhado interno violeta de 3px; foco com contorno branco externo.
- **Motion:** estados hover/foco em 180ms com `cubic-bezier(0.16, 1, 0.3, 1)`.

### Filter (DashboardFilter)

- **Atalhos:** Ano todo / Mês atual / Pico em botões brancos de 40px.
- **Mês específico:** Select compacto com ícone de calendário; abre somente Jan–Dez.
- **Seleção:** aplicada imediatamente; chip `2026 · período` confirma o filtro ativo.

### Panels

- **Standard Card:** `rounded-2xl` (16px), superfície `liquid-glass`, borda violeta translúcida, padding 1rem.
- **Glass KPI Card:** `GLASS_SURFACE` + `liquid-glass`, animação `kpi-enter` escalonada (80ms entre cards).
- **Team hero card:** borda gradiente 1px na cor da equipe; interior liquid glass com texto preto e retrato circular do líder, identificado pelo responsável do departamento no Bitrix.

### Data visualization

- **Trend bars (Chegada de leads):** colunas mensais, altura animada de baixo para cima, stagger 45ms; mês vazio = traço tracejado, sem barra.
- **StackedBar:** 10px altura, segmentos por fase; preenchimento horizontal animado com delay por segmento.
- **PhaseLegend:** grid 2 colunas; fade-in escalonado; números com `AnimatedNumber`.
- **Broker table:** cabeçalho sticky com blur; colunas numéricas centralizadas; zona Neg. perd. com largura fixa ~5rem.

### Motion vocabulary

- `kpi-enter`: opacity + translateY(14px) + scale(0.98) → 0, 550ms.
- `panel-enter`: opacity + translateY(12px), 450ms — painéis, transição de aba, linhas da tabela.
- `AnimatedNumber`: contagem 650ms ease-out-quart.
- Barras: width/height transition 500–700ms; respeita `prefers-reduced-motion`.

## Do's and Don'ts

### Do:

- **Do** manter funil ativo e perdas em blocos distintos (barras, legendas, colunas).
- **Do** deixar mês ou fase sem dado em branco (`—` ou traço), nunca inventar volume.
- **Do** usar Plus Jakarta Sans + `tabular-nums` em toda métrica comparável.
- **Do** manter o liquid glass discreto e atrás da hierarquia dos dados.
- **Do** animar entradas com easing `cubic-bezier(0.16, 1, 0.3, 1)` e respeitar reduced-motion.
- **Do** preferir tabela densa a cards para ranking de corretores.

### Don't:

- **Don't** usar CRM genérico roxo/indigo-on-white, painéis crypto/neon glow, ou glass que prejudique o contraste.
- **Don't** misturar perdas na mesma barra empilhada do funil ativo.
- **Don't** repetir eyebrow uppercase em cada seção — só no chrome de filtro e rótulos de bloco Funil/Perdas.
- **Don't** empilhar `border` + `box-shadow` largo no mesmo elemento (ghost-card).
- **Don't** usar gradiente em texto (`background-clip: text`).
- **Don't** colocar faixa colorida no topo dos KPIs glass (removido; cor fica nas barras internas de % da equipe).
