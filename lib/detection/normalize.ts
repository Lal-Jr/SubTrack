import { EXCLUDED_PHRASES, EXCLUDED_WORDS, MERCHANT_RULES, NOISE_WORDS, type MerchantRule } from './merchants';

export interface NormalizedMerchant {
    key: string;
    name: string;
    rule: MerchantRule | null;
}

/** Lowercase letters and digits only, single-spaced. Punctuation and separators become spaces. */
const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const titleCase = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

/** True when `phrase` occurs in `text` starting at a word boundary. */
const hasPhrase = (text: string, phrase: string) => ` ${text}`.includes(` ${phrase}`);

/** True for descriptions that can never be a subscription (loans, salary, self transfers...). */
export function isExcluded(description: string): boolean {
    const text = clean(description);
    if (EXCLUDED_PHRASES.some((p) => hasPhrase(text, p))) return true;
    const words = new Set(text.split(' '));
    return EXCLUDED_WORDS.some((w) => words.has(w));
}

export function normalizeMerchant(description: string, extraRules: MerchantRule[] = []): NormalizedMerchant {
    const text = clean(description);

    // Known merchants win. User rules are checked before the built-in list.
    for (const rule of [...extraRules, ...MERCHANT_RULES]) {
        if (rule.match.some((p) => hasPhrase(text, p))) {
            return { key: clean(rule.name), name: rule.name, rule };
        }
    }

    // Unknown merchant: drop UPI handles (anything@bank), noise words and reference numbers,
    // then keep the first few words that remain.
    const withoutHandles = description.toLowerCase().replace(/@\S*/g, ' ');
    const tokens = clean(withoutHandles)
        .split(' ')
        .filter((t) => t.length > 1 && !NOISE_WORDS.has(t) && !/\d/.test(t));
    const key = tokens.slice(0, 3).join(' ');
    return { key, name: titleCase(key), rule: null };
}
