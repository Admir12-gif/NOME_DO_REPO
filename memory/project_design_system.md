---
name: Design System TMS
description: Paleta de cores, tokens CSS e classes utilitárias do sistema visual do TransLog TMS
type: project
---

## Paleta de cores
- Sidebar: oklch(0.13 0.045 265) — Deep Navy
- Primary: oklch(0.52 0.23 260) — Electric Blue
- Background: oklch(0.972 0.004 255) — Slate frio
- Success: oklch(0.56 0.19 155) — Emerald
- Warning: oklch(0.73 0.17 76) — Amber
- Destructive: oklch(0.55 0.22 22) — Rose

## Classes utilitárias (globals.css)
- `.page-header` — flex justify-between mb-6
- `.page-title` — text-xl font-semibold
- `.page-subtitle` — text-sm text-muted-foreground
- `.kpi-card` — bg-card rounded-xl border p-5 shadow-sm
- `.kpi-card-value` — text-2xl font-bold tabular
- `.kpi-card-label` — text-xs uppercase tracking-wider muted
- `.badge-planejada/andamento/concluida/cancelada` — badges de status
- `.card-interactive` — hover lift + shadow
- `.nav-section-label` — label de seção do sidebar
- `.gradient-primary` — gradiente azul para botões e ícones
- `.scrollbar-thin` — scrollbar estilizada para sidebar

## Padrão de página
Cada página deve ter:
1. `<div className="space-y-5">`
2. `<div className="page-header">` com `.page-title` e `.page-subtitle`
3. Conteúdo em `bg-card rounded-xl border border-border/60 shadow-sm p-5`

**Why:** Redesign feito em 2026-05-06 a pedido do usuário para nível enterprise.
**How to apply:** Usar estas classes em qualquer nova página/componente criado.
