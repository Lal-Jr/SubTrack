// lib/SubscriptionClassifier.ts

export type FrequencyBucket = "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly" | "unknown";
export type SubscriptionStatus = "confirmed_subscription" | "probable_subscription" | "possible_subscription";

export interface ClassificationResult {
    frequency: FrequencyBucket;
    status: SubscriptionStatus;
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
}

const SUBSCRIPTION_KEYWORDS = ['premium', 'subscription', 'media', 'netflix', 'youtube', 'spotify', 'apple', 'amazon prime', 'prime'];

function getIntervalBucket(days: number): FrequencyBucket {
    if (days >= 6 && days <= 8) return "weekly";
    if (days >= 13 && days <= 15) return "biweekly";
    if (days >= 27 && days <= 33) return "monthly";
    if (days >= 85 && days <= 95) return "quarterly";
    if (days >= 350 && days <= 380) return "yearly";
    return "unknown";
}

function computeIntervals(dates: Date[]): number[] {
    const differences: number[] = [];
    for (let i = 1; i < dates.length; i++) {
        const diffTime = Math.abs(dates[i].getTime() - dates[i - 1].getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        differences.push(diffDays);
    }
    return differences;
}

export function analyzePriceHistory(prices: number[]) {
    if (prices.length === 0) return { min: 0, max: 0, avg: 0, changed: false };

    let sum = 0;
    let min = Infinity;
    let max = -Infinity;

    let changed = false;
    for (let i = 0; i < prices.length; i++) {
        const p = prices[i];
        sum += p;
        if (p < min) min = p;
        if (p > max) max = p;

        if (i > 0) {
            const prev = prices[i - 1];
            // Any jump > 15%
            if (prev > 0) {
                const pctChange = Math.abs(p - prev) / prev;
                if (pctChange > 0.15) {
                    changed = true;
                }
            } else if (p > 0) {
                changed = true;
            }
        }
    }

    return {
        min,
        max,
        avg: sum / prices.length,
        changed
    };
}

export function classifySubscription(merchantRaw: string, merchantNormalized: string, dates: Date[], amountsMap: number[]): ClassificationResult | null {
    const datesSorted = [...dates].sort((a, b) => a.getTime() - b.getTime());

    const intervals = computeIntervals(datesSorted);
    const intervalsCategorized = intervals.map(getIntervalBucket);

    const frequencyCounts: Record<string, number> = {
        "weekly": 0, "biweekly": 0, "monthly": 0, "quarterly": 0, "yearly": 0, "unknown": 0
    };
    for (const cat of intervalsCategorized) {
        frequencyCounts[cat]++;
    }

    let dominantFrequency: FrequencyBucket = "unknown";
    let dominantRatio = 0;

    for (const [freq, count] of Object.entries(frequencyCounts)) {
        if (freq === "unknown") continue;
        const ratio = count / intervals.length;
        if (ratio >= 0.7 && ratio > dominantRatio) {
            dominantFrequency = freq as FrequencyBucket;
            dominantRatio = ratio;
        }
    }

    const txnCount = datesSorted.length;
    const priceAnalysis = analyzePriceHistory(amountsMap);

    let status: SubscriptionStatus | null = null;
    let confidence = 0;
    let needsMoreData = false;

    // RULE 1: >= 3 occurrences AND >= 70% fit frequency bucket
    if (txnCount >= 3) {
        if (dominantFrequency !== "unknown") {
            status = "confirmed_subscription";
            confidence = 0.90; // Between 0.85-0.99 
        } else {
            return null; // Don't include irregular payments
        }
    }
    // RULE 2: Exactly 2 occurrences
    else if (txnCount === 2) {
        const interval = intervals[0];
        const bucket = getIntervalBucket(interval);

        if (bucket !== "unknown") {
            status = "probable_subscription";
            confidence = 0.75;
            dominantFrequency = bucket;
        } else {
            // Irregular 2 payments - we do not include as requested (no random one-time payments)
            return null;
        }
    }
    // RULE 3: Exactly 1 occurrence
    else if (txnCount === 1) {
        const rawLower = merchantRaw.toLowerCase();

        let hasKeyword = false;
        for (const kw of SUBSCRIPTION_KEYWORDS) {
            if (rawLower.includes(kw)) {
                hasKeyword = true;
                break;
            }
        }

        const amt = amountsMap[0];
        const looksLikeSubscriptionPrice = amt >= 99 && amt <= 999;
        const looksLikeYearlyPrice = amt >= 1500 && amt <= 5000;

        if (hasKeyword || looksLikeSubscriptionPrice || looksLikeYearlyPrice) {
            status = "possible_subscription";
            confidence = 0.50;
            needsMoreData = true;
            if (looksLikeYearlyPrice) {
                dominantFrequency = "yearly";
            }
            if (!hasKeyword && !looksLikeSubscriptionPrice) {
                // strict logic: don't randomly guess one off charges if neither keyword nor likely sub price
                if (!rawLower.includes('youtube') && !rawLower.includes('apple') && !rawLower.includes('netflix')) {
                    return null;
                }
            }
        } else {
            return null; // Do not include random one time payments
        }
    } else {
        return null;
    }

    if (!status) return null;

    let nextExpected: Date | null = null;
    if ((dominantFrequency !== "unknown" && txnCount > 1) || status === "possible_subscription") {
        nextExpected = new Date(datesSorted[datesSorted.length - 1]);
        if (dominantFrequency === "weekly") nextExpected.setDate(nextExpected.getDate() + 7);
        else if (dominantFrequency === "biweekly") nextExpected.setDate(nextExpected.getDate() + 14);
        else if (dominantFrequency === "monthly") nextExpected.setMonth(nextExpected.getMonth() + 1);
        else if (dominantFrequency === "quarterly") nextExpected.setMonth(nextExpected.getMonth() + 3);
        else if (dominantFrequency === "yearly") nextExpected.setFullYear(nextExpected.getFullYear() + 1);
        else nextExpected = null; // No guess
    }

    return {
        frequency: dominantFrequency,
        status: status,
        price_history: amountsMap,
        average_amount: Number(priceAnalysis.avg.toFixed(2)),
        current_amount: amountsMap[amountsMap.length - 1],
        first_amount: amountsMap[0],
        price_changed: priceAnalysis.changed,
        needs_more_data: needsMoreData,
        first_payment_date: datesSorted[0].toISOString(),
        last_payment_date: datesSorted[datesSorted.length - 1].toISOString(),
        next_expected_date: nextExpected ? nextExpected.toISOString() : null,
        confidence_score: confidence
    };
}
