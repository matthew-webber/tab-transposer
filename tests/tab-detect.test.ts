import { expect, test } from 'bun:test';
import { detectBlocks, parseLine } from '../lib/tab-detect.ts';

const PAGE = `Tuning: EADGBe

[Intro]
e|-----------------------------|
B|-----------------------------|
G|--666666666666---------------|
D|--666666666666----8888888888-|
A|--444444444444----8888888888-|
E|------------------6666666666-|

  About 10 strums per chord, Some of the strumming isnt full, and some of the
chords ring out longer than others, but it can be played like the above

[Verse]
G          D           Em
Saturday night - - - and I'm all alone
|-----3---|
|---------|
Eb|--0h2--|
Ab|-------|
Db|--3/5--|
Gb|-------|`;

test('finds stave blocks and nothing else', () => {
  const blocks = detectBlocks(PAGE);
  expect(blocks.map((b) => b.lines.length)).toEqual([6, 6]);
  const [intro] = blocks;
  expect(intro.lines[0].prefix).toBe('e|');
  const line = intro.lines[2];
  expect(PAGE.slice(line.bodyStart, line.bodyStart + line.body.length)).toBe('--666666666666---------------|');
});

test('rejects prose, chord and lyric lines', () => {
  for (const line of [
    'Tuning: EADGBe',
    '[Intro]',
    'G          D           Em',
    'Saturday night - - - and I\'m all alone',
    '  About 10 strums per chord',
    'A - 10 bars',
    '--------------------',
  ]) expect(parseLine(line)).toBeNull();
});

test('accepts common stave prefixes', () => {
  expect(parseLine('e|--3--|')?.prefix).toBe('e|');
  expect(parseLine('  Eb|--3--|')?.prefix).toBe('  Eb|');
  expect(parseLine('D --3-- ')?.body).toBe('--3--');
  expect(parseLine('|---12---|')?.prefix).toBe('|');
});

test('ignores runs shorter than a bass stave', () => {
  expect(detectBlocks('e|--3--|\nB|--3--|\nG|--3--|')).toEqual([]);
});

test('handles CRLF line endings', () => {
  const text = ['e|--3--|', 'B|--3--|', 'G|--3--|', 'D|--3--|'].join('\r\n');
  const [block] = detectBlocks(text);
  expect(block.lines[3].body).toBe('--3--|');
  expect(text.slice(block.lines[1].bodyStart, block.lines[1].bodyStart + 6)).toBe('--3--|');
});
