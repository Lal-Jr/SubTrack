// lib/detectRecurring.ts
import { normalizeMerchant } from './normalizeMerchant';
import { classifySubscription, SubscriptionStatus, FrequencyBucket } from './SubscriptionClassifier';

export type Transaction = {
    date: string;        // ISO string
    description: string;
    amount: number;      // negative = debit, positive = credit
};

export type SubscriptionOutput = {
    merchant: string;
    normalized_merchant: string;
    frequency: FrequencyBucket;
    status: SubscriptionStatus;
    transaction_count: number;
    price_history: number[];
    average_amount: number;
    current_amount: number;
    first_amount: number;
    price_changed: boolean;
    needs_more_data: boolean;
    first_payment_date: string;
    last_payment_date: string;
    next_expected_date: string | null;
    confidence_score: number;
};

// Exclude keywords for Noise Filtering
const EXCLUDE_KEYWORDS = ['emi', 'loan', 'interest', 'cred', 'salary', 'neft salary'];

function isValidDebit(t: Transaction): boolean {
    if (t.amount >= 0) return false; // Must be debit

    const upperDesc = t.description.toLowerCase();

    for (const kw of EXCLUDE_KEYWORDS) {
        if (upperDesc.includes(kw)) return false;
    }

    // Exclude Peer UPI (single personal names) - A very basic heuristic here is looking for "@" 
    // where the prefix doesn't have obvious merchant patterns, or just relying on normalization.
    // However, the rule explicitly mentions "Self transfers"
    if (upperDesc.includes('self transfer') || upperDesc.includes('to self')) return false;

    return true;
}


// Refund Handling: If a transaction is reversed within 7 days, ignore it
// Since we don't have credits explicitly linked in the prompt format outside of matching amounts, 
// a robust refund engine matches debits to credits of the same absolute amount within 7 days.
function filterRefunds(transactions: Transaction[]): Transaction[] {
    const debits = transactions.filter(isValidDebit);
    const credits = transactions.filter(t => t.amount > 0);

    const validDebits: Transaction[] = [];
    const usedCredits = new Set<string>();

    for (const d of debits) {
        let refunded = false;
        const dDate = new Date(d.date).getTime();

        for (let i = 0; i < credits.length; i++) {
            if (usedCredits.has(i.toString())) continue;
            const c = credits[i];

            // Check if amount matches exactly
            if (Math.abs(d.amount) === c.amount) {
                const cDate = new Date(c.date).getTime();
                const daysDiff = (cDate - dDate) / (1000 * 60 * 60 * 24);

                if (daysDiff >= 0 && daysDiff <= 7) {
                    refunded = true;
                    usedCredits.add(i.toString());
                    break;
                }
            }
        }

        if (!refunded) {
            validDebits.push(d);
        }
    }

    return validDebits;
}


export function detectRecurringSubscriptions(transactions: Transaction[]): SubscriptionOutput[] {
    const validDebits = filterRefunds(transactions);

    const grouped: Record<string, { originalName: string, txns: Transaction[] }> = {};

    for (const txn of validDebits) {
        const normalized = normalizeMerchant(txn.description);
        if (!normalized || normalized.length < 2) continue;

        if (!grouped[normalized]) {
            grouped[normalized] = { originalName: txn.description.substring(0, 50), txns: [] };
        }
        grouped[normalized].txns.push(txn);
    }

    const results: SubscriptionOutput[] = [];

    for (const [normalizedMerchant, data] of Object.entries(grouped)) {
        // Sort chronologically
        data.txns.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const dates = data.txns.map(t => new Date(t.date));
        const amounts = data.txns.map(t => Math.abs(t.amount));

        const classification = classifySubscription(data.originalName, normalizedMerchant, dates, amounts);

        if (classification) {
            results.push({
                merchant: data.originalName,
                normalized_merchant: normalizedMerchant,
                frequency: classification.frequency,
                status: classification.status,
                transaction_count: data.txns.length,
                price_history: classification.price_history,
                average_amount: classification.average_amount,
                current_amount: classification.current_amount,
                first_amount: classification.first_amount,
                price_changed: classification.price_changed,
                needs_more_data: classification.needs_more_data,
                first_payment_date: classification.first_payment_date,
                last_payment_date: classification.last_payment_date,
                next_expected_date: classification.next_expected_date,
                confidence_score: classification.confidence_score
            });
        }
    }

    // Sort descending by confidence then current amount
    results.sort((a, b) => {
        if (b.confidence_score !== a.confidence_score) {
            return b.confidence_score - a.confidence_score;
        }
        return b.current_amount - a.current_amount;
    });

    return results;
}
