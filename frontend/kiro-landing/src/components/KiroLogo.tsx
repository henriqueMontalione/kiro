/**
 * Brand lockup: official K isotype + KIRO wordmark.
 * The SVG file lives in public/assets so Vite serves it at /assets/KIRO-v1.svg.
 */
export function KiroLogo({ size = 32, showWord = true }: { size?: number; showWord?: boolean }) {
  return (
    <span className="inline-flex items-center gap-[10px] text-[var(--fg-1)]">
      <img
        src="/assets/KIRO-v1.svg"
        width={size}
        height={size}
        alt=""
        aria-hidden="true"
      />
      {showWord && (
        <span
          className="font-display font-bold uppercase"
          style={{ fontSize: Math.round(size * 0.72), letterSpacing: '0.06em' }}
        >
          KIRO
        </span>
      )}
    </span>
  );
}
