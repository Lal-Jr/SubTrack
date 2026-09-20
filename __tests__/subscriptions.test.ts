import { describe, test, expect } from 'vitest';
import { chargesBetween, nextChargeOnOrAfter, nthCharge, upcomingRenewals } from '../lib/subscriptions/schedule';
import { categoryBreakdown, forecast, totals, yearlyMinor } from '../lib/subscriptions/totals';
import { formatInterval } from '../lib/format';
import { parseDay, formatDay } from '../lib/detection/dates';
import type { SubscriptionRow } from '../lib/subscriptions/types';

const sub = (over: Partial<SubscriptionRow> = {}): SubscriptionRow => ({
  id: 'x', name: 'Netflix', amount: 199, currency: 'INR', interval_count: 1, interval_unit: 'month',
  last_charge_date: null, next_charge_date: '2025-03-10', source: 'manual', confidence: 1, active: 1,
  category: 'Entertainment', tags: null, is_variable: 0, ...over,
});
const day = (s: string) => parseDay(s);

describe('schedule', () => {
  test('month-end billing does not drift', () => {
    const anchor = day('2025-01-31');
    expect(formatDay(nthCharge(anchor, 1, 'month', 1))).toBe('2025-02-28');
    expect(formatDay(nthCharge(anchor, 1, 'month', 2))).toBe('2025-03-31');
  });
  test('rolls a stale date forward to the next occurrence', () => {
    expect(formatDay(nextChargeOnOrAfter(sub({ next_charge_date: '2024-11-10' }), day('2025-03-01'))!)).toBe('2025-03-10');
  });
  test('a date today counts as upcoming today', () => {
    expect(formatDay(nextChargeOnOrAfter(sub(), day('2025-03-10'))!)).toBe('2025-03-10');
  });
  test('weekly, custom and yearly intervals', () => {
    const weekly = chargesBetween(sub({ interval_unit: 'week', next_charge_date: '2025-03-03' }), day('2025-03-01'), day('2025-03-31')).map(formatDay);
    expect(weekly).toEqual(['2025-03-03', '2025-03-10', '2025-03-17', '2025-03-24', '2025-03-31']);
    expect(chargesBetween(sub({ interval_count: 3, next_charge_date: '2025-01-15' }), day('2025-01-01'), day('2025-12-31')).map(formatDay))
      .toEqual(['2025-01-15', '2025-04-15', '2025-07-15', '2025-10-15']);
    expect(chargesBetween(sub({ interval_unit: 'year', next_charge_date: '2025-06-01' }), day('2025-01-01'), day('2026-12-31'))).toHaveLength(2);
  });
  test('bad or missing dates yield nothing', () => {
    expect(chargesBetween(sub({ next_charge_date: null }), 0, 1e13)).toEqual([]);
    expect(nextChargeOnOrAfter(sub({ next_charge_date: 'oops' }), 0)).toBeNull();
  });
  test('upcoming renewals are windowed, sorted and skip cancelled subscriptions', () => {
    const subs = [
      sub({ id: 'a', name: 'Late', next_charge_date: '2025-03-25' }),
      sub({ id: 'b', name: 'Soon', next_charge_date: '2025-03-05' }),
      sub({ id: 'c', name: 'Cancelled', next_charge_date: '2025-03-04', active: 0 }),
      sub({ id: 'd', name: 'Far', next_charge_date: '2025-06-01', interval_unit: 'year' }),
    ];
    const r = upcomingRenewals(subs, day('2025-03-03'), 30);
    expect(r.map((x) => x.sub.name)).toEqual(['Soon', 'Late']);
    expect(r[0].daysUntil).toBe(2);
  });
});

describe('totals', () => {
  test('normalises every interval to yearly and monthly', () => {
    expect(yearlyMinor(sub({ amount: 100, interval_unit: 'year' }))).toBe(10000);
    expect(yearlyMinor(sub({ amount: 100, interval_unit: 'week' }))).toBe(520000);
    expect(yearlyMinor(sub({ amount: 300, interval_count: 3 }))).toBe(120000);
  });
  test('only active subscriptions in the chosen currency are summed', () => {
    const t = totals([sub({ amount: 100 }), sub({ amount: 50, active: 0 }), sub({ amount: 10, currency: 'USD' })], 'INR');
    expect(t).toEqual({ activeCount: 1, monthlyMinor: 10000, yearlyMinor: 120000, otherCurrencyCount: 1 });
  });
  test('categories are ranked with shares that add up', () => {
    const c = categoryBreakdown([sub({ amount: 300 }), sub({ amount: 100, category: null }), sub({ amount: 100, category: 'Software' })], 'INR');
    expect(c.map((x) => x.category)).toEqual(['Entertainment', 'Other', 'Software']);
    expect(c.reduce((a, x) => a + x.share, 0)).toBeCloseTo(1);
  });
});

describe('forecast', () => {
  test('puts a yearly charge only in the month it lands', () => {
    const f = forecast([sub({ amount: 1200, interval_unit: 'year', next_charge_date: '2025-05-20' })], day('2025-03-10'), 6, 'INR');
    expect(f.map((m) => m.totalMinor)).toEqual([0, 0, 120000, 0, 0, 0]);
    expect(f[2].month).toBe('2025-05');
  });
  test('current month only counts charges from today onward', () => {
    const f = forecast([sub({ next_charge_date: '2025-03-05' })], day('2025-03-10'), 2, 'INR');
    expect(f[0]).toMatchObject({ month: '2025-03', partial: true, totalMinor: 0 });
    expect(f[1]).toMatchObject({ month: '2025-04', totalMinor: 19900 });
  });
});

test('formatInterval', () => {
  expect(formatInterval(1, 'month')).toBe('Monthly');
  expect(formatInterval(3, 'month')).toBe('Every 3 months');
});
