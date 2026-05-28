/** Brazilian document and contact formatters shared across forms and read-only displays. */

export function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

/** 99.999.999/9999-99 */
export function formatCnpj(d: string): string {
  const x = digitsOnly(d).slice(0, 14);
  if (x.length <= 2) return x;
  if (x.length <= 5) return `${x.slice(0, 2)}.${x.slice(2)}`;
  if (x.length <= 8) return `${x.slice(0, 2)}.${x.slice(2, 5)}.${x.slice(5)}`;
  if (x.length <= 12) return `${x.slice(0, 2)}.${x.slice(2, 5)}.${x.slice(5, 8)}/${x.slice(8)}`;
  return `${x.slice(0, 2)}.${x.slice(2, 5)}.${x.slice(5, 8)}/${x.slice(8, 12)}-${x.slice(12)}`;
}

/** 999.999.999-99 */
export function formatCpf(d: string): string {
  const x = digitsOnly(d).slice(0, 11);
  if (x.length <= 3) return x;
  if (x.length <= 6) return `${x.slice(0, 3)}.${x.slice(3)}`;
  if (x.length <= 9) return `${x.slice(0, 3)}.${x.slice(3, 6)}.${x.slice(6)}`;
  return `${x.slice(0, 3)}.${x.slice(3, 6)}.${x.slice(6, 9)}-${x.slice(9)}`;
}

/** (XX) 9XXXX-XXXX — only formats 11-digit Brazilian cell numbers. */
export function formatPhone(d: string): string {
  const x = digitsOnly(d).slice(0, 11);
  if (x.length <= 2) return x.length ? `(${x}` : '';
  if (x.length <= 7) return `(${x.slice(0, 2)}) ${x.slice(2)}`;
  return `(${x.slice(0, 2)}) ${x.slice(2, 7)}-${x.slice(7)}`;
}
