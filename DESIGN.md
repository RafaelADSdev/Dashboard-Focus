---
name: Sales Compass Visual — Focus
description: Dashboard comercial Focus — funil, equipes e corretores a partir do Bitrix.
colors:
  canvas: "oklch(0.145 0.02 264)"
  surface: "oklch(0.205 0.025 265)"
  surface-elevated: "oklch(0.22 0.03 265 / 0.6)"
  ink: "oklch(0.98 0.005 250)"
  ink-muted: "oklch(0.70 0.02 260)"
  ink-faint: "oklch(0.55 0.02 260)"
  border: "oklch(1 0 0 / 0.1)"
  accent-elite-from: "#0ea5e9"
  accent-elite-to: "#22d3ee"
  accent-lider-from: "#10b981"
  accent-lider-to: "#14b8a6"
  accent-total-from: "#f59e0b"
  accent-total-to: "#f97316"
  phase-tentativa: "#14b8a6"
  phase-agendados: "#6366f1"
  phase-realizados: "#0ea5e9"
  phase-em-atendimento: "#f59e0b"
  phase-propostas: "#8b5cf6"
  phase-contratos: "#10b981"
  phase-negocios-perdidos: "#ef4444"
  phase-prazos-perdidos: "#f97316"
  loss: "#f87171"
  shadcn-primary: "oklch(0.208 0.042 265.755)"
  shadcn-background: "oklch(1 0 0)"
typography:
  title:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.15em"
  metric:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
rounded:
  sm: "0.375rem"
  md: "0.625rem"
  lg: "0.75rem"
  pill: "9999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.25rem"
  panel: "1rem"
components:
  filter-pill-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.pill}"
    padding: "0.25rem 0.625rem"
  filter-pill:
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.pill}"
    padding: "0.25rem 0.625rem"
  panel:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.panel}"
  tab-active:
    textColor: "{colors.canvas}"
    rounded: "{rounded.pill}"
    padding: "0.375rem 1rem"
---

## Overview

**North star: War Room Comercial.** Superfície escura de reunião — densidade alta, contraste forte, cor só onde o dado exige (fase, equipe, perda). A UI serve o ritual semanal de panorama Focus: filtrar mês, comparar equipes, ler funil ativo vs perdas, inspecionar corretor por etapa.

Filosofia: ferramenta que desaparece na tarefa. Tipografia de sistema, métricas tabulares, painéis com borda sutil (sem sombra larga). Anti-referências: SaaS roxo, glow neon, grids de cards genéricos.

## Colors

Canvas slate quase-preto (`canvas` / `surface`) com tinta clara. Neutros carregam 90% da UI.

**Equipes** usam gradientes curtos só em aba ativa e KPI da equipe (Elite sky→cyan, Líder esmeralda→teal, Total âmbar→laranja).

**Fases** são um vocabulário semântico fixo (ver tokens `phase-*`). Perdas (`negocios-perdidos`, `prazos-perdidos`, `loss`) ficam no bloco visual separado — nunca misturadas na mesma barra do funil ativo.

Tokens shadcn em `src/styles.css` (`:root` / `.dark`) existem para componentes Radix; o dashboard principal pinta com utilitários Tailwind slate + hex de fase, não com `--primary` claro.

## Typography

Uma família sans de sistema em toda a superfície (product register). Escala fixa em rem:

- Título de página ~`text-2xl`/`text-3xl`, peso 700, tracking levemente negativo (≥ −0.04em)
- Métricas grandes (`text-4xl`/`text-5xl`) com `tabular-nums`
- Corpo e tabelas em `text-xs` / `text-sm`
- Labels de filtro: uppercase + tracking largo, uso **escasso** (só no chrome de filtro, não em toda seção)

## Elevation

Quase flat. Painéis: `border` + fundo `slate-900/60`, sem box-shadow amplo. Separação por tom e borda 1px, não por lift. Gradiente de página (`from-slate-950 via-slate-900`) é atmosfera de fundo, não “card flutuante”.

## Components

- **Filter pills / tabs**: pill; ativo = fundo claro ou gradiente de equipe; inativo = borda slate + hover.
- **Panel**: `rounded-2xl` (~16px), padding 1rem, borda slate-800; opcional filete superior em gradiente de equipe.
- **Stacked phase bar**: altura ~10px; segmentos só com valor > 0; mês/fase vazios = traço ou `—`.
- **Broker row**: avatar 32px (foto Bitrix ou iniciais) + nome + células numéricas; coluna de perdas visualmente à direita com divisor.
- **Avatar fallback**: fundo slate-800, iniciais em ink-muted.

## Do's and Don'ts

**Do**

- Manter funil ativo e perdas em blocos distintos
- Deixar mês sem leads em branco
- Preferir tabela densa a cards para corretores
- Usar cor de fase/equipe com significado, não decoração

**Don't**

- Preencher meses ou fases com ruído sintético
- Misturar perdas na mesma barra empilhada do funil ativo
- Introduzir glassmorphism, glow, ou gradiente em texto
- Repetir eyebrow uppercase em cada painel
- Trocar a sans de sistema por display serif no dashboard
