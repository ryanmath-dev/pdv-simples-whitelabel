/** Junta classNames condicionalmente (sem dependência externa). */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
