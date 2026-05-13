/**
 * Logo lockup. Renders the isotype + the KIRO wordmark as text.
 * Pass `showWord={false}` for the isotype-only icon variant.
 */
export function KiroLogo({ size = 28, showWord = true }: { size?: number; showWord?: boolean }) {
  return (
    <span className="inline-flex items-center gap-[10px] text-[var(--fg-1)]">
      <img src="/kiro-logo.svg" width={size} height={size} alt="" />
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
