import { describe, test, expect } from 'vitest';
import { detectSubscriptions, normalizeMerchant, toInterval, type Transaction } from '../lib/detection';
import { toMinor } from '../types/money';

const ASOF = new Date('2025-03-15T00:00:00Z');
const debit = (date: string, description: string, amount: number): Transaction => ({ date, description, amountMinor: -toMinor(amount) });
const credit = (date: string, description: string, amount: number): Transaction => ({ date, description, amountMinor: toMinor(amount) });
const detect = (t: Transaction[]) => detectSubscriptions(t, { asOf: ASOF });

describe('normalizeMerchant', () => {
  test('known merchant wins over bank noise', () => {
    expect(normalizeMerchant('UPI-NETFLIX COM-NETFLIXUPI.PAYU@HDFCBANK').name).toBe('Netflix');
  });
  test('unknown merchant: strips rails, handles and reference numbers', () => {
    expect(normalizeMerchant('UPI-IRON TEMPLE GYM-9876543210@ybl').key).toBe('iron temple gym');
    expect(normalizeMerchant('POS 4512XX8899 BLUE BOTTLE COFFEE').key).toBe('blue bottle coffee');
  });
  test('user rules take priority over built-ins', () => {
    const rule = { name: 'My Streamer', match: ['netflix'], category: 'Other', subscription: true };
    expect(normalizeMerchant('NETFLIX', [rule]).name).toBe('My Streamer');
  });
  test('does not match inside another word', () => {
    expect(normalizeMerchant('MAXIMUM FITNESS').rule).toBeNull();
  });
});

describe('detectSubscriptions', () => {
  test('stable monthly subscription is confirmed', () => {
    const [s] = detect([
      debit('2025-01-01', 'UPI-NETFLIX COM-NETFLIXUPI.PAYU@HDFCBANK', 199),
      debit('2025-02-01', 'UPI-NETFLIX COM-NETFLIXUPI.PAYU@HDFCBANK', 199),
      debit('2025-03-01', 'UPI-NETFLIX COM-NETFLIXUPI.PAYU@HDFCBANK', 199),
    ]);
    expect(s).toMatchObject({ merchant: 'Netflix', frequency: 'monthly', status: 'confirmed', priceChanged: false, active: true, amountMinor: 19900, nextDate: '2025-04-01', annualCostMinor: 19900 * 12 });
  });

  test('price change is detected and the latest price is used', () => {
    const r = detect([
      debit('2024-11-01', 'POS APPLE COM BILLING', 219),
      debit('2024-12-01', 'POS APPLE COM BILLING', 219),
      debit('2025-01-01', 'POS APPLE COM BILLING', 749),
      debit('2025-02-01', 'POS APPLE COM BILLING', 749),
      debit('2025-03-01', 'POS APPLE COM BILLING', 749),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ merchant: 'Apple Services', priceChanged: true, amountMinor: 74900, status: 'confirmed' });
  });

  test('a single charge from a known subscription merchant is only "possible"', () => {
    const [s] = detect([debit('2025-03-01', 'YOUTUBE PREMIUM', 195)]);
    expect(s).toMatchObject({ status: 'possible', frequency: 'monthly', occurrences: 1 });
    expect(s.confidence).toBeLessThan(0.5);
  });

  test('an old single charge is not called cancelled and has no guessed next date', () => {
    const [s] = detect([debit('2024-06-01', 'AMAZON PRIME YR', 1499)]);
    expect(s).toMatchObject({ status: 'possible', active: true, nextDate: null });
  });

  test('a single charge from an unknown merchant is ignored, whatever the price', () => {
    expect(detect([debit('2025-03-01', 'BLUE BOTTLE COFFEE', 250)])).toHaveLength(0);
  });

  test('loans, EMIs and salary are excluded', () => {
    expect(detect([
      debit('2025-01-01', 'LOAN EMI HDFC', 5000),
      debit('2025-02-01', 'LOAN EMI HDFC', 5000),
      debit('2025-03-01', 'LOAN EMI HDFC', 5000),
    ])).toHaveLength(0);
  });

  test('two yearly charges are probable', () => {
    const [s] = detectSubscriptions(
      [debit('2024-03-01', 'AMAZON PRIME YR', 1499), debit('2025-03-01', 'AMAZON PRIME YR', 1499)],
      { asOf: ASOF },
    );
    expect(s).toMatchObject({ merchant: 'Amazon Prime', frequency: 'yearly', status: 'probable', nextDate: '2026-03-01' });
  });

  test('a refunded charge does not count', () => {
    const [s] = detect([
      debit('2025-01-01', 'SPOTIFY', 119),
      credit('2025-01-02', 'SPOTIFY REFUND', 119),
      debit('2025-02-01', 'SPOTIFY', 119),
      debit('2025-03-01', 'SPOTIFY', 119),
    ]);
    expect(s).toMatchObject({ occurrences: 2, status: 'probable' });
  });

  test('erratic spending at one merchant is not a subscription', () => {
    expect(detect([
      debit('2025-01-05', 'UBER RIDES', 350),
      debit('2025-01-10', 'UBER RIDES', 120),
      debit('2025-01-15', 'UBER RIDES', 400),
    ])).toHaveLength(0);
  });

  test('regular but constantly varying amounts from an unknown merchant are bills, not subscriptions', () => {
    expect(detect([
      debit('2025-01-05', 'CITY POWER BOARD', 812),
      debit('2025-02-05', 'CITY POWER BOARD', 1430),
      debit('2025-03-05', 'CITY POWER BOARD', 956),
    ])).toHaveLength(0);
  });

  test('weekly and biweekly frequencies', () => {
    const weekly = detect([1, 8, 15, 22].map((d) => debit(`2025-03-${String(d).padStart(2, '0')}`, 'FRESH MILK CLUB', 90)));
    expect(weekly[0].frequency).toBe('weekly');
    const biweekly = detect([1, 15, 29].map((d) => debit(`2025-01-${String(d).padStart(2, '0')}`, 'LAWN CARE CO', 500)));
    expect(biweekly[0].frequency).toBe('biweekly');
  });

  test('one skipped month does not break a monthly series', () => {
    const [s] = detect([
      debit('2024-10-01', 'IRON TEMPLE GYM', 1200),
      debit('2024-11-01', 'IRON TEMPLE GYM', 1200),
      debit('2025-01-01', 'IRON TEMPLE GYM', 1200),
      debit('2025-02-01', 'IRON TEMPLE GYM', 1200),
      debit('2025-03-01', 'IRON TEMPLE GYM', 1200),
    ]);
    expect(s.frequency).toBe('monthly');
  });

  test('a subscription with no charge for over two cycles is inactive with no next date', () => {
    const [s] = detect([
      debit('2024-08-01', 'NETFLIX', 199),
      debit('2024-09-01', 'NETFLIX', 199),
      debit('2024-10-01', 'NETFLIX', 199),
    ]);
    expect(s).toMatchObject({ active: false, nextDate: null });
  });

  test('duplicate rows for the same day and amount are collapsed', () => {
    const r = detect([
      debit('2025-01-01', 'NETFLIX', 199), debit('2025-01-01', 'NETFLIX', 199),
      debit('2025-02-01', 'NETFLIX', 199), debit('2025-03-01', 'NETFLIX', 199),
    ]);
    expect(r[0].occurrences).toBe(3);
  });

  test('month-end billing clamps to the last day of the next month', () => {
    const [s] = detectSubscriptions(
      [debit('2024-11-30', 'NETFLIX', 199), debit('2024-12-30', 'NETFLIX', 199), debit('2025-01-31', 'NETFLIX', 199)],
      { asOf: new Date('2025-02-10T00:00:00Z') },
    );
    expect(s.nextDate).toBe('2025-02-28');
  });

  test('invalid dates and zero amounts are skipped without throwing', () => {
    expect(detect([debit('not-a-date', 'NETFLIX', 199), { date: '2025-02-31', description: 'NETFLIX', amountMinor: -100 }, debit('2025-01-01', 'NETFLIX', 0)])).toEqual([]);
  });

  test('results are sorted active first, then by annual cost', () => {
    const r = detect([
      debit('2025-01-01', 'NETFLIX', 199), debit('2025-02-01', 'NETFLIX', 199), debit('2025-03-01', 'NETFLIX', 199),
      debit('2025-01-02', 'ADOBE', 1675), debit('2025-02-02', 'ADOBE', 1675), debit('2025-03-02', 'ADOBE', 1675),
    ]);
    expect(r.map((s) => s.merchant)).toEqual(['Adobe', 'Netflix']);
  });
});

test('toInterval maps frequencies to the subscriptions table vocabulary', () => {
  expect(toInterval('quarterly')).toEqual({ count: 3, unit: 'month' });
  expect(toInterval('biweekly')).toEqual({ count: 2, unit: 'week' });
});
