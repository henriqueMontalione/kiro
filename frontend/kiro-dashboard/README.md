# Kiro Dashboard

High-fidelity Kiro **merchant dashboard** — the PayFi product that turns retail sales into instant cash on the Stellar network — built with **React 18 + Vite 5 + TypeScript 5 + Tailwind CSS 3.4**.

The dashboard is rebuilt 1:1 from the Kiro design system. Verde Kiro is the only saturated color in the UI; Roxo Estelar appears only on accents (avatar, Pro upgrade, watermarks); all money is rendered in `Roboto Mono` with `tabular-nums`.

---

## Stack

| Layer | Choice |
| --- | --- |
| Build | [Vite 5](https://vite.dev/) + [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react) |
| Language | TypeScript 5.4 (strict) |
| Styling | Tailwind CSS 3.4, design tokens as CSS variables (`bg-[var(--bg-1)]` pattern) |
| Routing | `react-router-dom` v6 |
| Icons | `lucide-react` (matches the design system's stroke spec) |
| Charts | `recharts` — shadcn-style usage, themed entirely via Kiro tokens |
| Lint | ESLint 8 + `@typescript-eslint` + `eslint-plugin-react-hooks` |
| Format | Prettier 3 + `eslint-config-prettier` |

---

## Getting started

```bash
npm install
npm run dev          # http://localhost:5173
```

Then visit `/resumo`, `/transacoes`, or `/recebimentos`. The root redirects to `/resumo`.

### Other scripts

```bash
npm run build        # type-check + production build → dist/
npm run preview      # serve the production build locally
npm run lint         # eslint check
npm run format       # prettier write across src/
```

---

## What's implemented

The codebase covers the three screens that the user picked when scoping the project:

| Route | Status | What's there |
| --- | --- | --- |
| `/resumo` | ✅ Full | Saldo Disponível (with eye-toggle blur), Rendimento Acumulado (Recharts area chart), Transações Recentes (top 5), Recebimentos Hoje (Recharts bar chart) |
| `/transacoes` | ✅ Full | Filterable list — search by order / label, status chips (Todos / Concluídos / Pendentes / Reembolsos) |
| `/recebimentos` | ✅ Full | Gallery of saved payment links + QR codes |
| `/extrato`, `/links`, `/clientes`, `/relatorios`, `/integracoes`, `/config` | 🚧 Placeholder | The screens render a "not built" card; chrome (sidebar, header) is fully functional |

**Interactions wired:**

- Sidebar navigation (real URLs via react-router-dom)
- Top-tab navigation (synced with sidebar)
- Toggle balance visibility (eye / eye-off icon on Saldo Disponível)
- "Receber via PIX agora" modal (lifted to `App`, openable from Resumo *and* Recebimentos)
- Notifications dropdown (fake content)
- ESC closes the PIX modal

---

## Project layout

```
kiro-dashboard/
├── public/
│   ├── kiro-logo.svg
│   ├── kiro-wordmark.svg
│   └── fonts/RobotoMono-VariableFont_wght.ttf
├── src/
│   ├── main.tsx                       # React root + <BrowserRouter>
│   ├── App.tsx                        # Shell + <Routes>
│   ├── index.css                      # Tailwind layers + base styles
│   ├── styles/
│   │   └── tokens.css                 # All Kiro design tokens (--bg-0, --kiro-green, …)
│   ├── lib/
│   │   ├── mocks.ts                   # All hardcoded data lives here
│   │   └── cn.ts                      # Tiny classname joiner
│   ├── types.ts                       # Transaction, NavItem, PaymentLink…
│   ├── components/
│   │   ├── Sidebar.tsx                # Fixed 248px left rail
│   │   ├── Header.tsx                 # Top tabs + bell / help / user
│   │   ├── TopTabs.tsx
│   │   ├── KiroLogo.tsx
│   │   ├── Button.tsx                 # 5 variants × 3 sizes
│   │   ├── IconButton.tsx
│   │   ├── StatusTag.tsx              # success / warning / danger / info / purple / neutral
│   │   ├── FilterChip.tsx
│   │   ├── Card.tsx                   # Card + CardEyebrow
│   │   ├── ProUpgradeCard.tsx
│   │   ├── NotificationsPopover.tsx
│   │   ├── FakeQR.tsx
│   │   ├── ReceberPixModal.tsx
│   │   └── cards/
│   │       ├── BalanceCard.tsx
│   │       ├── YieldCard.tsx
│   │       ├── TransactionsCard.tsx   # exports <TxRow/> too — reused on Transações
│   │       └── RecebimentosCard.tsx
│   └── pages/
│       ├── Resumo.tsx
│       ├── Transacoes.tsx
│       ├── Recebimentos.tsx
│       └── Placeholder.tsx
├── tailwind.config.ts
├── postcss.config.js
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── .eslintrc.cjs
├── .prettierrc
├── .gitignore
└── package.json
```

---

## How the design tokens are used

All Kiro tokens (colors, radii, shadows, fonts, motion, spacing) are defined as CSS variables in **`src/styles/tokens.css`**, imported by `src/index.css`. Tailwind is configured to **stay out of the way** — the only theme extension is fonts (`font-display`, `font-mono`, `font-sans`).

Everywhere else, tokens are referenced **directly via Tailwind arbitrary values**:

```tsx
<div className="bg-[var(--bg-1)] text-[var(--fg-2)] rounded-[var(--radius-md)] border border-[var(--stroke-2)]">
```

Why: it keeps the design system and the codebase 1:1. Rename `--bg-1` in the tokens file and every surface in the app shifts. No `tailwind.config.ts` regeneration step needed.

For the rare component-level values (radial gradients, layered glass effects, watermark "K"s), inline `style={{ ... }}` is used and the same CSS variables are referenced directly there.

---

## Adapting the data

All mock data lives in **`src/lib/mocks.ts`**. To wire a real API, swap each export for a `useQuery` / `useSWR` hook returning the same shapes (`Transaction[]`, `PaymentLink[]`, etc — see `src/types.ts`). The components don't know where the data comes from.

---

## Re-theming

1. Edit `src/styles/tokens.css` — change any of the `--kiro-*` or `--bg-*` values.
2. Restart `npm run dev`. Tailwind has nothing to recompile since tokens are referenced as arbitrary values.

To swap fonts: change the `@font-face` / `@import` declarations at the top of `tokens.css`, then update the matching stacks in `tailwind.config.ts`.

---

## Notes / caveats

- No backend, auth, or persistence — everything is hardcoded.
- The QR code on Recebimentos / the PIX modal is a deterministic decorative stub (`FakeQR`), not a real PIX BR Code.
- The transactions list is small (12 rows) — for a real product, virtualize with `@tanstack/react-virtual`.
- Recharts is fully tree-shakeable but ships ~80kb gzip; if that matters, the original hand-rolled SVG charts from the source UI kit can be dropped in instead — see `_legacy` references in the git log.
