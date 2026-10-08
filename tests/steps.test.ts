import { expect, test } from 'bun:test';
import { badgeText, clampFrets, formatSteps, stepLabel } from '../lib/steps.ts';

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
