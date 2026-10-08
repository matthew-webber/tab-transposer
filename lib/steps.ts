// Transposition is stored as a fret (semitone) offset. The UI speaks in whole
// steps: one click = ½ step = 1 fret, capped at ±5 steps.
export const MAX_FRETS = 10;

export const clampFrets = (frets: number) =>
  Math.max(-MAX_FRETS, Math.min(MAX_FRETS, Math.round(frets) || 0));

/** Big popup value: "0", "+1.5", "−2". */
export function formatSteps(frets: number): string {
  if (!frets) return '0';
  return `${frets > 0 ? '+' : '−'}${Math.abs(frets) / 2}`;
}

/** Toolbar badge (ASCII, ≤4 chars): "", "+1.5", "-2". */
export function badgeText(frets: number): string {
  if (!frets) return '';
  return `${frets > 0 ? '+' : '-'}${Math.abs(frets) / 2}`;
}

/** Readable label under the value: "", "Up ½ step", "Down 1½ steps". */
export function stepLabel(frets: number): string {
  if (!frets) return '';
  const n = Math.abs(frets);
  const whole = Math.floor(n / 2);
  const amount = whole === 0 ? '½' : `${whole}${n % 2 ? '½' : ''}`;
  return `${frets > 0 ? 'Up' : 'Down'} ${amount} ${n <= 2 ? 'step' : 'steps'}`;
}
