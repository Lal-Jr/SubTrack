import { describe, test, expect } from 'vitest';
import { parseAmount, parseDate, detectDateOrder, readGrid, detectCsv, extractCsv, parsePdfLines, dedupeKeys, type CsvOptions } from '../lib/import';

describe('parseAmount', () => {
  test.each([
    ['1,234.56', 123456], ['₹1,00,000.00', 10000000], ['Rs. 199', 19900], ['$5.5', 550],
    ['(199.00)', -19900], ['-199.00', -19900], ['199.00-', -19900], ['199.00 Dr', -19900], ['199.00 Cr', 19900],
    ['1.234,56', 123456], ['1,234', 123400], ['0.00', 0], ['-₹50', -5000],
  ])('%s -> %s', (raw, minor) => expect(parseAmount(raw)).toBe(minor));
  test.each(['', '  ', 'abc', '12abc', 'Rs', '--5'])('rejects %j', (raw) => expect(parseAmount(raw)).toBeNull());
  test('letters in "Rs" are not stripped from other text (old bug)', () => expect(parseAmount('Rs 1Cr')).toBe(100));
});

describe('parseDate', () => {
  test('numeric with explicit order', () => {
    expect(parseDate('03/04/2025', 'dmy')).toBe('2025-04-03');
    expect(parseDate('03/04/2025', 'mdy')).toBe('2025-03-04');
    expect(parseDate('05-01-25')).toBe('2025-01-05');
  });
  test('named months and ISO', () => {
    expect(parseDate('5 Jan 2025')).toBe('2025-01-05');
    expect(parseDate('05-Jan-25')).toBe('2025-01-05');
    expect(parseDate('Jan 5, 2025')).toBe('2025-01-05');
    expect(parseDate('2025-01-05T10:00:00')).toBe('2025-01-05');
  });
  test('rejects impossible dates', () => {
    expect(parseDate('31/02/2025')).toBeNull();
    expect(parseDate('hello')).toBeNull();
  });
  test('detects order from unambiguous samples, flags ambiguity', () => {
    expect(detectDateOrder(['03/04/2025', '25/04/2025'])).toEqual({ order: 'dmy', ambiguous: false });
    expect(detectDateOrder(['03/25/2025'])).toEqual({ order: 'mdy', ambiguous: false });
    expect(detectDateOrder(['03/04/2025', '05/06/2025'])).toEqual({ order: 'dmy', ambiguous: true });
  });
});

const opts = (d: ReturnType<typeof detectCsv>, over: Partial<CsvOptions> = {}): CsvOptions => ({
  headerRow: d.headerRow, mapping: d.mapping!, dateOrder: d.dateOrder, positiveIsDebit: false, ...over,
});

describe('CSV', () => {
  test('separate withdrawal/deposit columns below account metadata (Indian bank style)', () => {
    const grid = readGrid([
      'Account Statement,,,,,,',
      'Account No,12345,,,,,',
      'Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance',
      '01/01/25,UPI-NETFLIX COM-NETFLIXUPI.PAYU@HDFCBANK,0001,01/01/25,"1,199.00",,"50,000.00"',
      '15/01/25,SALARY ACME LTD,0002,15/01/25,,"80,000.00","130,000.00"',
      ',Total,,,,,',
    ].join('\n'));
    const d = detectCsv(grid);
    expect(d.headerRow).toBe(2);
    expect(d.mapping).toMatchObject({ date: 0, description: 1, debit: 4, credit: 5 });
    expect(d.dateOrder).toBe('dmy');
    const r = extractCsv(grid, opts(d));
    expect(r.transactions).toEqual([
      { date: '2025-01-01', description: 'UPI-NETFLIX COM-NETFLIXUPI.PAYU@HDFCBANK', amountMinor: -119900 },
      { date: '2025-01-15', description: 'SALARY ACME LTD', amountMinor: 8000000 },
    ]);
  });

  test('single signed amount, US dates, "Date" preferred over "Value Date"', () => {
    const grid = readGrid('Value Date,Transaction Date,Description,Amount\n01/25/2025,01/24/2025,SPOTIFY USA,-11.99\n01/26/2025,01/26/2025,PAYROLL,2500.00');
    const d = detectCsv(grid);
    expect(d.mapping!.date).toBe(1);
    expect(d.dateOrder).toBe('mdy');
    expect(extractCsv(grid, opts(d)).transactions.map((t) => t.amountMinor)).toEqual([-1199, 250000]);
  });

  test('amount + Dr/Cr type column', () => {
    const grid = readGrid('Date,Description,Amount,Dr/Cr\n05-Jan-2025,Gym,"1,200.00",DR\n06-Jan-2025,Refund,50.00,CR');
    const d = detectCsv(grid);
    expect(d.mapping).toMatchObject({ amount: 2, type: 3 });
    expect(extractCsv(grid, opts(d)).transactions.map((t) => t.amountMinor)).toEqual([-120000, 5000]);
  });

  test('credit-card exports where positive means a purchase', () => {
    const grid = readGrid('Date,Description,Amount\n2025-01-05,COFFEE,4.50\n2025-01-06,PAYMENT THANK YOU,-100.00');
    const d = detectCsv(grid);
    expect(extractCsv(grid, opts(d, { positiveIsDebit: true })).transactions.map((t) => t.amountMinor)).toEqual([-450, 10000]);
  });

  test('reports unreadable rows and unrecognised headers', () => {
    const grid = readGrid('Date,Description,Amount\nsoon,X,5.00\n2025-01-05,Y,\n2025-01-06,Z,3.00');
    const r = extractCsv(grid, opts(detectCsv(grid)));
    expect(r.transactions).toHaveLength(1);
    expect(r.warnings).toHaveLength(2);
    expect(detectCsv(readGrid('a,b,c\n1,2,3')).mapping).toBeNull();
  });

  test('handles a BOM and semicolon delimiters', () => {
    const grid = readGrid('﻿Date;Description;Amount\n2025-01-05;Tea;-3,50');
    expect(extractCsv(grid, opts(detectCsv(grid))).transactions[0].amountMinor).toBe(-350);
  });
});

describe('PDF lines', () => {
  test('withdrawal / deposit / balance layout with wrapped narration and footer', () => {
    const r = parsePdfLines([
      'Statement of Account',
      'Date Narration Chq./Ref.No. Value Dt Withdrawal Amt. Deposit Amt. Closing Balance',
      '01/01/25 UPI-NETFLIX COM-NETFLIXUPI 0000123456789 01/01/25 199.00 0.00 9,801.00',
      'PAYU@HDFCBANK',
      '15/01/25 SALARY ACME LTD 0000987654321 15/01/25 0.00 50,000.00 59,801.00',
      'Closing Balance 59,801.00',
      'Page 1 of 1',
    ]);
    expect(r.transactions).toEqual([
      { date: '2025-01-01', description: 'UPI-NETFLIX COM-NETFLIXUPI PAYU@HDFCBANK', amountMinor: -19900 },
      { date: '2025-01-15', description: 'SALARY ACME LTD', amountMinor: 5000000 },
    ]);
    expect(r.warnings).toEqual([]);
  });

  test('amount + balance rows: sign comes from the running balance, oldest first', () => {
    const r = parsePdfLines([
      '01 Jan 2025 OPENING PURCHASE STORE 100.00 900.00',
      '02 Jan 2025 GYM MEMBERSHIP FEES 200.00 700.00',
      '03 Jan 2025 FRIEND PAID BACK 500.00 1,200.00',
    ]);
    expect(r.transactions.map((t) => t.amountMinor)).toEqual([-10000, -20000, 50000]);
  });

  test('newest-first statements are read correctly', () => {
    const r = parsePdfLines([
      '03/01/2025 FRIEND PAID BACK 500.00 1,200.00',
      '02/01/2025 GYM MEMBERSHIP FEES 200.00 700.00',
      '01/01/2025 COFFEE SHOP DOWNTOWN 100.00 900.00',
    ]);
    expect(r.transactions.map((t) => t.amountMinor)).toEqual([50000, -20000, -10000]);
  });

  test('Dr/Cr suffixes are trusted', () => {
    const r = parsePdfLines(['01/02/2025 ELECTRIC BOARD 1,250.00 Dr', '02/02/2025 CASHBACK PROMO 20.00 Cr']);
    expect(r.transactions.map((t) => t.amountMinor)).toEqual([-125000, 2000]);
  });

  test('warns when direction had to be guessed', () => {
    const r = parsePdfLines(['01/02/2025 SOMETHING UNCLEAR 75.00']);
    expect(r.transactions[0].amountMinor).toBe(-7500);
    expect(r.warnings[0]).toMatch(/guessed/);
  });
});

describe('dedupeKeys', () => {
  const t = (date: string, description: string, amountMinor: number) => ({ date, description, amountMinor });
  test('same row twice gets distinct, repeatable keys', () => {
    const row = t('2025-01-01', 'Coffee  Shop', -450);
    const keys = dedupeKeys([row, row]);
    expect(new Set(keys).size).toBe(2);
    expect(dedupeKeys([row, row])).toEqual(keys);
  });
  test('an overlapping statement produces matching keys', () => {
    const a = [t('2025-01-01', 'A', -1), t('2025-01-02', 'B', -2)];
    const b = [t('2025-01-02', 'b', -2), t('2025-01-03', 'C', -3)];
    const known = new Set(dedupeKeys(a));
    expect(dedupeKeys(b).map((k) => known.has(k))).toEqual([true, false]);
  });
});
