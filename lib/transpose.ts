// Shifts fret numbers in one stave block and keeps the strings column-aligned
// when numbers change width (8 → 10).

export interface FretToken {
  col: number;
  len: number;
  value: number;
}

/** A fret that was below 0 and moved up an octave, located in the output body. */
export interface WrappedFret {
  line: number;
  col: number;
  len: number;
}

export interface TransposedBlock {
  bodies: string[];
  wrapped: WrappedFret[];
}

const MAX_FRET = 24;

const isFretPair = (s: string) => s.length === 2 && s[0] !== '0' && Number(s) <= MAX_FRET;

/**
 * Splits digit runs into frets. "12" is fret 12, but "666666" is six strums of
 * fret 6 (common in punk/rhythm tabs), and "1210" is 12 then 10.
 */
export function tokenize(body: string): FretToken[] {
  const tokens: FretToken[] = [];
  for (const m of body.matchAll(/\d+/g)) {
    const run = m[0];
    const at = m.index;
    if (run.length > 2 && /^(\d)\1+$/.test(run)) {
      for (let i = 0; i < run.length; i++) tokens.push({ col: at + i, len: 1, value: Number(run[i]) });
      continue;
    }
    for (let i = 0; i < run.length; ) {
      const len = isFretPair(run.slice(i, i + 2)) ? 2 : 1;
      tokens.push({ col: at + i, len, value: Number(run.slice(i, i + len)) });
      i += len;
    }
  }
  return tokens;
}

export function shiftFret(value: number, frets: number): { value: number; wrapped: boolean } {
  let next = value + frets;
  let wrapped = false;
  while (next < 0) {
    next += 12;
    wrapped = true;
  }
  return { value: next, wrapped };
}

interface Cluster {
  start: number;
  end: number;
}

/** Column spans where at least one string has a fret, merged where they overlap. */
function clustersOf(tokens: FretToken[][]): Cluster[] {
  const spans = tokens.flat().sort((a, b) => a.col - b.col);
  const clusters: Cluster[] = [];
  for (const t of spans) {
    const last = clusters.at(-1);
    if (last && t.col < last.end) last.end = Math.max(last.end, t.col + t.len);
    else clusters.push({ start: t.col, end: t.col + t.len });
  }
  return clusters;
}

/** One string's slice of a cluster, with frets shifted and filler dashes trimmed. */
function renderSlice(body: string, tokens: FretToken[], c: Cluster, frets: number) {
  const own = tokens.filter((t) => t.col >= c.start && t.col < c.end);
  const original = body.slice(c.start, c.end);
  if (!own.length) return { text: /^-*$/.test(original) ? '' : original, wrapped: [] as number[][] };

  let text = '';
  let pos = c.start;
  let prevEnd = -1;
  let prevGrew = false;
  const wrapped: number[][] = [];
  for (const t of own) {
    text += body.slice(pos, t.col);
    const shifted = shiftFret(t.value, frets);
    const s = String(shifted.value);
    const grew = s.length > t.len;
    if (t.col === prevEnd && (grew || prevGrew)) text += '-';
    if (shifted.wrapped) wrapped.push([text.length, s.length]);
    text += s;
    pos = prevEnd = t.col + t.len;
    prevGrew = grew;
  }
  text += body.slice(pos, c.end);
  return { text: text.replace(/-+$/, ''), wrapped };
}

/** Transposes every string body of a block. Always pass the original bodies. */
export function transposeBodies(bodies: string[], frets: number): TransposedBlock {
  if (!frets) return { bodies: [...bodies], wrapped: [] };
  const tokens = bodies.map(tokenize);
  const out = bodies.map(() => '');
  const wrapped: WrappedFret[] = [];
  let cursor = 0;
  let prev: { end: number; grew: boolean } | null = null;

  for (const c of clustersOf(tokens)) {
    bodies.forEach((b, i) => (out[i] += b.slice(cursor, c.start)));
    // Strings that end before this column (ragged staves) are left alone.
    const reaches = bodies.map((b) => b.length > c.start);
    const slices = bodies.map((b, i) => renderSlice(b, tokens[i], c, frets));
    const width = Math.max(1, ...slices.map((s) => s.text.length));
    const grew = width > c.end - c.start;
    // Adjacent single-digit strums that became two digits need a separator,
    // otherwise 6666 +4 would read as 10101010.
    if (prev && prev.end === c.start && (grew || prev.grew)) {
      bodies.forEach((_, i) => reaches[i] && (out[i] += '-'));
    }
    slices.forEach((s, i) => {
      if (!reaches[i]) return;
      for (const [col, len] of s.wrapped) wrapped.push({ line: i, col: out[i].length + col, len });
      out[i] += s.text.padEnd(width, '-');
    });
    cursor = c.end;
    prev = { end: c.end, grew };
  }
  bodies.forEach((b, i) => (out[i] += b.slice(cursor)));
  return { bodies: out, wrapped };
}
