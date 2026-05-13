import type { Config } from 'tailwindcss';

/**
 * Kiro tailwind config.
 *
 * Per design-system decision, the project uses **CSS variables directly via
 * arbitrary values** (e.g. `bg-[var(--bg-1)]`, `text-[var(--fg-2)]`,
 * `rounded-[var(--radius-md)]`) so tokens stay 1:1 with the design system.
 *
 * The only theme extension here is fonts — typing `font-display` /
 * `font-sans` / `font-mono` everywhere is significantly cleaner than
 * `font-[var(--font-display)]` and the font stacks themselves don't change
 * per-component.
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['Roboto Mono', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
