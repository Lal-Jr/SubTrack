/**
 * Money is stored as an integer count of minor units (paise, cents) to avoid
 * floating point drift when summing, averaging and projecting amounts.
 */
export type Minor = number;

const MINOR_PER_MAJOR = 100;

export function toMinor(major: number): Minor {
  return Math.round(major * MINOR_PER_MAJOR);
}

export function toMajor(minor: Minor): number {
  return minor / MINOR_PER_MAJOR;
}

export function formatMoney(minor: Minor, currency = 'INR', locale?: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(toMajor(minor));
}
