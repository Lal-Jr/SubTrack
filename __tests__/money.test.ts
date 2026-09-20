import { describe, test, expect } from 'vitest';
import { toMinor, toMajor, formatMoney } from '../types/money';

describe('money', () => {
  test('rounds float input to integer minor units', () => {
    expect(toMinor(19.99)).toBe(1999);
    expect(toMinor(0.1 + 0.2)).toBe(30);
  });
  test('round-trips', () => {
    expect(toMajor(toMinor(749))).toBe(749);
  });
  test('formats with currency', () => {
    expect(formatMoney(19900, 'INR', 'en-IN')).toContain('199');
  });
});
