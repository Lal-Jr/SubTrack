// __tests__/subscriptionDetection.test.ts

import { detectRecurringSubscriptions, Transaction } from '../lib/detectRecurring';

describe('Deterministic Subscription Detection Engine', () => {

    test('Netflix stable - 3 months', () => {
        const txns: Transaction[] = [
            { date: "2025-01-01T10:00:00Z", description: "UPI-NETFLIX COM-NETFLIXUPI.PAYU@HDFCBANK", amount: -199 },
            { date: "2025-02-01T10:00:00Z", description: "UPI-NETFLIX COM-NETFLIXUPI.PAYU@HDFCBANK", amount: -199 },
            { date: "2025-03-01T10:00:00Z", description: "UPI-NETFLIX COM-NETFLIXUPI.PAYU@HDFCBANK", amount: -199 },
        ];

        const result = detectRecurringSubscriptions(txns);
        expect(result.length).toBe(1);
        expect(result[0].normalized_merchant).toBe("netflix");
        expect(result[0].status).toBe("confirmed_subscription");
        expect(result[0].frequency).toBe("monthly");
        expect(result[0].price_changed).toBe(false);
    });

    test('Apple price change - stable to stable', () => {
        const txns: Transaction[] = [
            { date: "2024-11-01T10:00:00Z", description: "POS APPLE COM BILLING", amount: -219 },
            { date: "2024-12-01T10:00:00Z", description: "POS APPLE COM BILLING", amount: -219 },
            { date: "2025-01-01T10:00:00Z", description: "POS APPLE COM BILLING", amount: -749 },
            { date: "2025-02-01T10:00:00Z", description: "POS APPLE COM BILLING", amount: -749 },
            { date: "2025-03-01T10:00:00Z", description: "POS APPLE COM BILLING", amount: -749 },
        ];

        const result = detectRecurringSubscriptions(txns);
        expect(result.length).toBe(1);
        expect(result[0].normalized_merchant).toBe("apple billing");
        expect(result[0].status).toBe("confirmed_subscription");
        expect(result[0].price_changed).toBe(true);
        expect(result[0].current_amount).toBe(749);
    });

    test('YouTube single 195 payment', () => {
        const txns: Transaction[] = [
            { date: "2025-03-01T10:00:00Z", description: "YOUTUBE PREMIUM", amount: -195 },
        ];

        const result = detectRecurringSubscriptions(txns);
        expect(result.length).toBe(1);
        expect(result[0].status).toBe("possible_subscription");
        expect(result[0].needs_more_data).toBe(true);
        expect(result[0].normalized_merchant).toBe("youtube premium");
    });

    test('EMI exclusion', () => {
        const txns: Transaction[] = [
            { date: "2025-01-01T10:00:00Z", description: "LOAN EMI HDFC", amount: -5000 },
            { date: "2025-02-01T10:00:00Z", description: "LOAN EMI HDFC", amount: -5000 },
            { date: "2025-03-01T10:00:00Z", description: "LOAN EMI HDFC", amount: -5000 },
        ];

        // Should be filtered entirely because 'emi' / 'loan' are exclusion keywords
        const result = detectRecurringSubscriptions(txns);
        expect(result.length).toBe(0);
    });

    test('Yearly subscription example', () => {
        const txns: Transaction[] = [
            { date: "2024-03-01T10:00:00Z", description: "AMAZON PRIME YR", amount: -1499 },
            { date: "2025-03-01T10:00:00Z", description: "AMAZON PRIME YR", amount: -1499 },
        ];

        const result = detectRecurringSubscriptions(txns);
        expect(result.length).toBe(1);
        expect(result[0].normalized_merchant).toBe("amazon prime yr");
        expect(result[0].frequency).toBe("yearly");
        expect(result[0].status).toBe("probable_subscription");
        // 2024 to 2025 in a leap year is 365 or 366 days, which fits the bucket.
    });

    test('Refund handling', () => {
        const txns: Transaction[] = [
            { date: "2025-01-01T10:00:00Z", description: "SPOTIFY", amount: -119 },
            { date: "2025-01-02T10:00:00Z", description: "SPOTIFY REFUND", amount: 119 }, // Refunded within 7 days
            { date: "2025-02-01T10:00:00Z", description: "SPOTIFY", amount: -119 },
            { date: "2025-03-01T10:00:00Z", description: "SPOTIFY", amount: -119 },
        ];

        const result = detectRecurringSubscriptions(txns);
        expect(result.length).toBe(1);
        // We had 3 debits, 1 was refunded. So valid txnCount = 2
        expect(result[0].transaction_count).toBe(2);
        expect(result[0].status).toBe("probable_subscription");
    });
});
