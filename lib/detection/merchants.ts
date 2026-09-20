import type { Frequency } from './types';

/**
 * Data, not logic: extend or override these without touching the engine.
 * Phrases are lowercase and match at word starts of the cleaned description.
 */
export interface MerchantRule {
    name: string;
    match: string[];
    /** Matches the category options used across the app. */
    category: string;
    /** True if a single charge is enough to suggest a subscription. */
    subscription: boolean;
    /** Billing period to assume when only one charge has been seen. */
    frequency?: Frequency;
}

export const MERCHANT_RULES: MerchantRule[] = [
    // Streaming and media
    { name: 'Netflix', match: ['netflix'], category: 'Entertainment', subscription: true },
    { name: 'Spotify', match: ['spotify'], category: 'Entertainment', subscription: true },
    { name: 'YouTube Premium', match: ['youtube', 'google youtube'], category: 'Entertainment', subscription: true },
    { name: 'Amazon Prime', match: ['amazon prime', 'prime video', 'amzn prime'], category: 'Entertainment', subscription: true },
    { name: 'Disney+', match: ['disney', 'hotstar'], category: 'Entertainment', subscription: true },
    { name: 'Apple Services', match: ['apple com', 'apple services', 'apple media', 'itunes', 'icloud'], category: 'Entertainment', subscription: true },
    { name: 'ZEE5', match: ['zee5'], category: 'Entertainment', subscription: true },
    { name: 'SonyLIV', match: ['sonyliv', 'sony liv'], category: 'Entertainment', subscription: true },
    { name: 'JioCinema', match: ['jiocinema', 'jio cinema'], category: 'Entertainment', subscription: true },
    { name: 'HBO Max', match: ['hbo max', 'max com'], category: 'Entertainment', subscription: true },
    { name: 'Hulu', match: ['hulu'], category: 'Entertainment', subscription: true },
    // Software
    { name: 'Google One', match: ['google one', 'google storage'], category: 'Software', subscription: true },
    { name: 'Microsoft 365', match: ['microsoft 365', 'office 365', 'msft'], category: 'Software', subscription: true },
    { name: 'Adobe', match: ['adobe'], category: 'Software', subscription: true },
    { name: 'ChatGPT', match: ['openai', 'chatgpt'], category: 'Software', subscription: true },
    { name: 'Claude', match: ['anthropic', 'claude ai'], category: 'Software', subscription: true },
    { name: 'GitHub', match: ['github'], category: 'Software', subscription: true },
    { name: 'Dropbox', match: ['dropbox'], category: 'Software', subscription: true },
    { name: 'Notion', match: ['notion labs', 'notion so'], category: 'Software', subscription: true },
    // Telecom and utilities
    { name: 'Airtel', match: ['airtel'], category: 'Utilities', subscription: false },
    { name: 'Jio', match: ['reliance jio', 'jio prepaid', 'jio postpaid'], category: 'Utilities', subscription: false },
];

/** Words that carry no merchant identity: payment rails, banks and transaction plumbing. */
export const NOISE_WORDS = new Set([
    // Rails and plumbing (global)
    'pos', 'ach', 'debit', 'card', 'purchase', 'payment', 'pymt', 'recurring', 'autopay', 'mandate',
    'ref', 'txn', 'trf', 'transfer', 'online', 'www', 'com', 'net', 'org', 'inc', 'ltd', 'llc', 'pvt',
    'refund', 'reversal', 'reversed', 'rev', 'dr', 'cr',
    // India rails and gateways
    'upi', 'neft', 'imps', 'rtgs', 'nach', 'emandate', 'payu', 'razorpay', 'billdesk', 'ccavenue', 'paytm', 'phonepe', 'gpay',
    // Bank names and UPI handles
    'bank', 'hdfc', 'hdfcbank', 'icici', 'axis', 'sbi', 'kotak', 'ybl', 'ibl', 'axl', 'okhdfcbank', 'okicici', 'oksbi', 'okaxis',
]);

/** A debit whose description contains any of these words is never treated as a subscription. */
export const EXCLUDED_WORDS = ['emi', 'loan', 'interest', 'salary', 'cred', 'dividend', 'self', 'atm', 'cash'];
export const EXCLUDED_PHRASES = ['self transfer', 'to self', 'credit card bill', 'card bill payment'];
