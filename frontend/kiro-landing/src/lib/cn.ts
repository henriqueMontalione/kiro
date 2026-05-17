/** Tiny classname joiner — keeps the dependency surface small. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
