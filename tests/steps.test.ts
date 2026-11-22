import { expect, test } from 'bun:test';
import { badgeText, clampFrets, describeShifts, formatSteps, splitShifts, stepLabel } from '../lib/steps.ts';

test('clamps to ±5 whole steps', () => {
  expect(clampFrets(11)).toBe(10);
  expect(clampFrets(-12)).toBe(-10);
  expect(clampFrets(Number.NaN)).toBe(0);
});

test('formats the value, badge and label', () => {
  expect([0, 1, 3, -4].map(formatSteps)).toEqual(['0', '+0.5', '+1.5', '−2']);
  expect([0, 3, -4, 10].map(badgeText)).toEqual(['', '+1.5', '-2', '+5']);
  expect([0, 1, -2, 3, -10].map(stepLabel)).toEqual(['', 'Up ½ step', 'Down 1 step', 'Up 1½ steps', 'Down 5 steps']);
});

test('per-string shifts split into the common move plus offsets', () => {
  expect(splitShifts([2, 2, 2, 2, 2, 2])).toEqual({ frets: 2, offsets: null });
  // Standard tab, played in Drop D.
  expect(splitShifts([0, 0, 0, 0, 0, 2])).toEqual({ frets: 0, offsets: [0, 0, 0, 0, 0, 2] });
  // Drop D tab, played in D Standard.
  expect(splitShifts([2, 2, 2, 2, 2, 0])).toEqual({ frets: 2, offsets: [0, 0, 0, 0, 0, -2] });
  // Standard → Open G: a 3–3 tie goes to the smaller move.
  expect(splitShifts([2, 0, 0, 0, 2, 2])).toEqual({ frets: 0, offsets: [2, 0, 0, 0, 2, 2] });
});

test('describes per-string shifts', () => {
  expect(describeShifts([0, 0, 0, 0, 0, 2])).toBe('6th string up 1 step');
  expect(describeShifts([2, 2, 2, 2, 2, 0])).toBe('Up 1 step, 6th string as written');
  expect(describeShifts([2, 0, 0, 0, 2, 2])).toBe('1st, 5th and 6th strings up 1 step');
  expect(describeShifts([5, 5, 5, 5, 5, 7])).toBe('Up 2½ steps, 6th string up 3½ steps');
  expect(describeShifts([0, 0, 0, 0])).toBe('');
});
