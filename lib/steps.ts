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

/**
 * Splits per-string shifts (1st string first) into the amount most strings
 * move, which the − / + control then adjusts, and each string's difference
 * from it (null when every string moves the same). Ties go to the smaller move.
 */
export function splitShifts(shifts: readonly number[]): { frets: number; offsets: number[] | null } {
  const counts = new Map<number, number>();
  for (const s of shifts) counts.set(s, (counts.get(s) ?? 0) + 1);
  let base = 0;
  let best = -1;
  for (const [s, n] of counts) if (n > best || (n === best && Math.abs(s) < Math.abs(base))) [base, best] = [s, n];
  const frets = clampFrets(base);
  const offsets = shifts.map((s) => s - frets);
  return { frets, offsets: offsets.some(Boolean) ? offsets : null };
}

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

/** "6th string up 1 step", "Up 1 step, 6th string as written"; empty when nothing moves. */
export function describeShifts(shifts: readonly number[]): string {
  const { frets, offsets } = splitShifts(shifts);
  const groups = new Map<number, string[]>();
  offsets?.forEach((o, i) => o && groups.set(frets + o, [...(groups.get(frets + o) ?? []), ORDINALS[i] ?? `${i + 1}th`]));
  const parts = frets ? [stepLabel(frets)] : [];
  for (const [shift, names] of groups) {
    const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
    parts.push(`${list} string${names.length > 1 ? 's' : ''} ${shift ? stepLabel(shift).toLowerCase() : 'as written'}`);
  }
  const text = parts.join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
