// Pure TypeScript utility with no external dependencies (date-fns removed for native performance)

export type Transaction = {
    date: string;        // ISO string
    description: string;
    amount: number;      // negative = debit, positive = credit
};

export type Subscription = {
    merchant: string;
    frequency: "Weekly" | "Monthly" | "Quarterly";
    averageAmount: number;
    occurrences: number;
    lastPayment: string;
    nextExpectedPayment: string;
    annualCost: number;
    confidenceScore: number; // 0–1
};

// Ignore keywords
const IGNORE_KEYWORDS = ['SALARY', 'INTEREST', 'REV', 'REFUND'];

// Noise keywords to strip during merchant normalization
const NOISE_KEYWORDS = ['UPI', 'NEFT', 'POS', 'MANDATE', 'AUTOPAY', 'PAYU', 'HDFCBANK', 'AXIS', 'ICICI', 'SBI', 'COM'];

// Common known merchants for explicit keyword detection
const KNOWN_MERCHANTS = ['NETFLIX', 'APPLE', 'EMI', 'AIRTEL', 'CRED', 'AMAZON', 'SPOTIFY', 'GOOGLE', 'YOUTUBE'];

/**
 * Normalizes a raw transaction description into a cleaner merchant name.
 * Extracts known merchants if present, or strips noise words to leave a core name.
 */
function normalizeMerchant(description: string): string {
    const upperDesc = description.toUpperCase();

    // 1. Explicit known merchant detection
    for (const merchant of KNOWN_MERCHANTS) {
        if (upperDesc.includes(merchant)) {
            return merchant;
        }
    }

    // 2. Stripping noise otherwise
    let normalized = upperDesc;

    // Remove special characters, replace with spaces
    normalized = normalized.replace(/[^A-Z0-9]/g, ' ');

    // Remove noise words
    const words = normalized.split(/\s+/);
    const cleanWords = words.filter(word => {
        if (word.length <= 2) return false; // drop short artifacts
        if (NOISE_KEYWORDS.includes(word)) return false;
        // Drop purely numeric strings if they look like reference numbers
        if (/^\d+$/.test(word)) return false;
        return true;
    });

    return cleanWords.join(' ').trim() || description.substring(0, 15).trim();
}

/**
 * Calculates the day differences between consecutive, chronologically sorted dates.
 */
function calculateDayDifferences(sortedDates: Date[]): number[] {
    const differences: number[] = [];
    for (let i = 1; i < sortedDates.length; i++) {
        const diffTime = Math.abs(sortedDates[i].getTime() - sortedDates[i - 1].getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        differences.push(diffDays);
    }
    return differences;
}

/**
 * Detects the frequency based on average day differences.
 * Weekly: 6-8 days
 * Monthly: 27-32 days
 * Quarterly: 85-95 days
 */
function detectFrequency(avgDays: number): "Weekly" | "Monthly" | "Quarterly" | null {
    if (avgDays >= 6 && avgDays <= 8) return "Weekly";
    if (avgDays >= 27 && avgDays <= 32) return "Monthly";
    if (avgDays >= 85 && avgDays <= 95) return "Quarterly";
    return null;
}

/**
 * Calculates the variance/stability of a set of amounts.
 * Returns the maximum percentage deviation from the average.
 */
function calculateVariance(amounts: number[], average: number): number {
    if (average === 0) return 0;

    let maxVariancePercent = 0;
    for (const amt of amounts) {
        const deviation = Math.abs(amt - average);
        const percentDev = (deviation / Math.abs(average)) * 100;
        if (percentDev > maxVariancePercent) {
            maxVariancePercent = percentDev;
        }
    }

    return maxVariancePercent; // e.g., 5.5 means 5.5% max variance
}

/**
 * Calculates a confidence score (0-1) based on variance and day gaps.
 */
function calculateConfidence(maxVariancePercent: number, differences: number[], avgDays: number): number {
    let score = 1.0;

    // Deduct based on amount variance (up to 10% variance allowed by requirements)
    // If variance is 0%, no deduction. If 10%, deduct 0.2
    if (maxVariancePercent > 0) {
        score -= (maxVariancePercent / 10) * 0.2;
    }

    // Deduct based on interval inconsistency
    let totalIntervalDeviation = 0;
    for (const diff of differences) {
        totalIntervalDeviation += Math.abs(diff - avgDays);
    }
    const avgIntervalDeviation = totalIntervalDeviation / differences.length;

    // E.g., if average deviation is 2 days on a monthly sub, deduct a bit.
    // We'll normalize against the avgDays itself
    const intervalInstability = avgIntervalDeviation / avgDays;
    score -= (intervalInstability * 0.5); // Max 0.5 deduction for wild dates

    return Math.max(0.1, Math.min(1.0, score)); // Clamp between 0.1 and 1.0
}

/**
 * Main module function to detect recurring subscriptions from raw transactions.
 * 
 * Performance Complexity:
 * - Filtering/Normalization: O(N) where N is number of transactions.
 * - Grouping: O(N) to insert into a map.
 * - Sorting within groups: O(M * K log K) where M is number of merchants and K is avg transactions per merchant.
 * Overall Time Complexity: O(N log N) in the worst case where all txns belong to one merchant.
 * Space Complexity: O(N) to store normalized groups.
 */
export function detectRecurringSubscriptions(transactions: Transaction[]): Subscription[] {
    // 1. Filter out credits and ignored keywords
    const validDebits = transactions.filter(t => {
        if (t.amount >= 0) return false; // Must be debit

        const upperDesc = t.description.toUpperCase();
        for (const ignore of IGNORE_KEYWORDS) {
            if (upperDesc.includes(ignore)) return false;
        }

        return true;
    });

    // 2. Group by normalized merchant
    const grouped: Record<string, Transaction[]> = {};

    for (const txn of validDebits) {
        const merchant = normalizeMerchant(txn.description);
        if (!merchant) continue;

        if (!grouped[merchant]) {
            grouped[merchant] = [];
        }
        grouped[merchant].push(txn);
    }

    const detectedSubscriptions: Subscription[] = [];

    // 3. Analyze each group
    for (const [merchant, txns] of Object.entries(grouped)) {
        // Minimum 3 occurrences requirement
        if (txns.length < 3) continue;

        // Sort chronologically
        txns.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const amounts = txns.map(t => Math.abs(t.amount)); // use absolute numbers for spend
        const totalAmount = amounts.reduce((sum, val) => sum + val, 0);
        const averageAmount = totalAmount / amounts.length;

        // 5. Check amount stability (Max 10% variance)
        const maxVariance = calculateVariance(amounts, averageAmount);
        if (maxVariance > 10) {
            continue; // Fails variance check
        }

        const dates = txns.map(t => new Date(t.date));
        const dayDifferences = calculateDayDifferences(dates);

        const totalDays = dayDifferences.reduce((sum, val) => sum + val, 0);
        const avgDays = totalDays / dayDifferences.length;

        // 6. Detect frequency
        const frequency = detectFrequency(avgDays);
        if (!frequency) {
            continue; // Not a recognized recurring interval
        }

        // 7. Calculate final metrics
        const confidenceScore = calculateConfidence(maxVariance, dayDifferences, avgDays);
        const lastPaymentDate = dates[dates.length - 1];

        let daysToAdd = 30;
        let multiplier = 12;
        if (frequency === "Weekly") { daysToAdd = 7; multiplier = 52; }
        if (frequency === "Quarterly") { daysToAdd = 90; multiplier = 4; }

        const nextExpected = new Date(lastPaymentDate);
        nextExpected.setDate(nextExpected.getDate() + daysToAdd);
        const nextExpectedPayment = nextExpected.toISOString();
        const annualCost = averageAmount * multiplier;

        detectedSubscriptions.push({
            merchant,
            frequency,
            averageAmount: Number(averageAmount.toFixed(2)),
            occurrences: txns.length,
            lastPayment: lastPaymentDate.toISOString(),
            nextExpectedPayment,
            annualCost: Number(annualCost.toFixed(2)),
            confidenceScore: Number(confidenceScore.toFixed(3)),
        });
    }

    // 8. Sort descending by annualCost
    detectedSubscriptions.sort((a, b) => b.annualCost - a.annualCost);

    return detectedSubscriptions;
}

// =========================================================================
// Example Usage Snippet & Mock Data
// =========================================================================

export const mockTransactions: Transaction[] = [
    // Netflix - Normal Monthly (Valid)
    { date: "2025-01-12T10:00:00Z", description: "UPI-NETFLIX COM-NETFLIXUPI.PAYU@HDFCBANK", amount: -199 },
    { date: "2025-02-11T10:00:00Z", description: "UPI-NETFLIX COM-NETFLIXUPI.PAYU@HDFCBANK", amount: -199 },
    { date: "2025-03-12T10:00:00Z", description: "UPI-NETFLIX COM-NETFLIXUPI.PAYU@HDFCBANK", amount: -199 },

    // Apple - Quarterly (Valid)
    { date: "2025-01-01T15:00:00Z", description: "POS APPLE COM BILLING", amount: -999 },
    { date: "2025-04-02T15:00:00Z", description: "POS APPLE COM BILLING", amount: -999 },
    { date: "2025-07-01T15:00:00Z", description: "POS APPLE COM BILLING", amount: -999 },

    // Erratic spend (Should be ignored due to interval AND variance)
    { date: "2025-01-05T00:00:00Z", description: "UBER RIDES", amount: -350 },
    { date: "2025-01-10T00:00:00Z", description: "UBER RIDES", amount: -120 },
    { date: "2025-01-15T00:00:00Z", description: "UBER RIDES", amount: -400 },

    // Ignored Keyword (Salary/Refund)
    { date: "2025-01-01T00:00:00Z", description: "MONTHLY SALARY REFUND", amount: -50000 },
];

/* How to run:
   const subs = detectRecurringSubscriptions(mockTransactions);
   console.log(subs);
*/
