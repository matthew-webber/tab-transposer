// Finds tab staves in plain text. A stave line is a string label and/or bar
// followed by a body made only of tab characters, mostly dashes:
//   e|-----3---5h7---|      Eb|--0--      |---12---|
// Prose, chord lines and lyrics fail the body check, so only staves are touched.

export interface TabLine {
  /** Offset of the body (after the "e|" prefix) in the source text. */
  bodyStart: number;
  prefix: string;
  body: string;
}

export interface TabBlock {
  lines: TabLine[];
}

/** Bass/uke staves have 4 strings; fewer is more likely a false positive. */
export const MIN_STRINGS = 4;

const PREFIX = /^(\s*)([A-Ga-g][#b]?)?(\s*)([|:])?/;
// Dashes, frets, bars and common technique marks (hammer, pull, bend, release,
// slide, vibrato, harmonics, ghost notes, mutes, taps). No other letters.
const BODY = /^[-0-9|:hpbrxXsSvVtT/\\~().^*<>=+ ]+$/;

/**
 * Text after the closing bar that isn't more stave: a repeat count or note such
 * as "|    4 Times", "|  x4" or "|(x3)". It has no "--" and is either spaced
 * off from the bar or has letters in it.
 */
const isTrailingNote = (tail: string) =>
  tail.trim() !== '' && !tail.includes('--') && (/^\s/.test(tail) || /[A-Za-z]/.test(tail));

export function parseLine(line: string): { prefix: string; body: string } | null {
  const m = PREFIX.exec(line)!;
  if (!m[2] && !m[4]) return null;
  const prefix = m[0];
  let body = line.slice(prefix.length).trimEnd();
  const bar = body.lastIndexOf('|');
  if (bar >= 0 && isTrailingNote(body.slice(bar + 1))) body = body.slice(0, bar + 1);
  if (!body || !BODY.test(body) || !/--/.test(body)) return null;
  const dashes = body.split('-').length - 1;
  if (dashes / body.length < 0.15) return null;
  return { prefix, body };
}

export function detectBlocks(text: string): TabBlock[] {
  const blocks: TabBlock[] = [];
  let run: TabLine[] = [];
  const flush = () => {
    if (run.length >= MIN_STRINGS) blocks.push({ lines: run });
    run = [];
  };
  let offset = 0;
  for (const raw of text.split('\n')) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    const parsed = parseLine(line);
    if (parsed) run.push({ bodyStart: offset + parsed.prefix.length, ...parsed });
    else flush();
    offset += raw.length + 1;
  }
  flush();
  return blocks;
}
