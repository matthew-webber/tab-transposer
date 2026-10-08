import { expect, test } from 'bun:test';
import { detectBlocks } from '../lib/tab-detect.ts';
import { shiftFret, tokenize, transposeBodies } from '../lib/transpose.ts';

const INTRO = [
  'e|-----------------------------------------------------------------|',
  'B|-----------------------------------------------------------------|',
  'G|--666666666666---------------------------------------------------|',
  'D|--666666666666----888888888888-----44444444444----6666666666-----|',
  'A|--444444444444----888888888888-----44444444444----6666666666-----|',
  'E|-----------------666666666666-----22222222222----4444444444------|',
];

const transpose = (lines: string[], frets: number) => {
  const [block] = detectBlocks(lines.join('\n'));
  const { bodies, wrapped } = transposeBodies(block.lines.map((l) => l.body), frets);
  return { lines: bodies.map((b, i) => block.lines[i].prefix + b), wrapped };
};

test('repeated digits are separate strums; pairs up to 24 are one fret', () => {
  expect(tokenize('--6666--').map((t) => t.value)).toEqual([6, 6, 6, 6]);
  expect(tokenize('--12--3h5--22--').map((t) => t.value)).toEqual([12, 3, 5, 22]);
  expect(tokenize('1210').map((t) => t.value)).toEqual([12, 10]);
  expect(tokenize('-35-').map((t) => t.value)).toEqual([3, 5]);
  expect(tokenize('-05-').map((t) => t.value)).toEqual([0, 5]);
});

test('zero is a no-op', () => {
  expect(transpose(INTRO, 0).lines).toEqual(INTRO);
});

test('single-digit results keep the exact layout', () => {
  const { lines } = transpose(INTRO, 1);
  expect(lines[3]).toBe('D|--777777777777----999999999999-----55555555555----7777777777-----|');
  expect(lines[5]).toBe('E|-----------------777777777777-----33333333333----5555555555------|');
  expect(lines.map((l) => l.length)).toEqual(INTRO.map((l) => l.length));
});

test('widening frets separates strums and pads the other strings', () => {
  const lines = transpose(['e|--8-----|', 'B|--6-----|', 'G|--7-----|', 'D|--------|'], 2).lines;
  expect(lines).toEqual(['e|--10-----|', 'B|--8------|', 'G|--9------|', 'D|---------|']);

  const strums = transpose(['e|-------|', 'B|-------|', 'G|--888--|', 'D|--666--|'], 2).lines;
  expect(strums).toEqual(['e|------------|', 'B|------------|', 'G|--10-10-10--|', 'D|--8--8--8---|']);
});

test('every string stays the same length after transposing', () => {
  for (const frets of [-10, -3, 2, 4, 10]) {
    const lens = new Set(transpose(INTRO, frets).lines.map((l) => l.length));
    expect(lens.size).toBe(1);
  }
});

test('frets below zero move up an octave and are reported', () => {
  expect(shiftFret(0, -1)).toEqual({ value: 11, wrapped: true });
  expect(shiftFret(5, -2)).toEqual({ value: 3, wrapped: false });
  const { lines, wrapped } = transpose(['e|--0--3--|', 'B|--------|', 'G|--------|', 'D|--------|'], -2);
  expect(lines[0]).toBe('e|--10--1--|');
  expect(wrapped).toEqual([{ line: 0, col: 2, len: 2 }]);
});

test('narrowing frets drops the extra column', () => {
  const lines = transpose(['e|--10--|', 'B|--8---|', 'G|------|', 'D|------|'], -1).lines;
  expect(lines).toEqual(['e|--9--|', 'B|--7--|', 'G|-----|', 'D|-----|']);
});
