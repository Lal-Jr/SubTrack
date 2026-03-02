// lib/normalizeMerchant.ts

const GENERIC_WORDS = new Set([
    'upi', 'bank', 'hdfc', 'icici', 'axis', 'payu', 'mandate', 'ref', 'txn', 'payment',
    'sbi', 'com', 'neft', 'pos', 'autopay', 'razorpay', 'paytm', 'phonepe', 'gpay',
    'rtgs', 'imps', 'card', 'cr', 'dr', 'inr', 'rs', 'bill', 'desk', 'ccavenu', 'ccavenue',
    'billdesk', 'swiggy', 'zomato', 'blinkit', 'instamart', 'zepto' // Swiggy/Zomato might be generic noise if we are looking for purely subscriptons, but maybe keep them for one-time? User only asked to remove specific ones.
]);

// Let's stick strictly to what the user defined as generic + common knowledge
const USER_GENERIC_WORDS = new Set([
    'upi', 'bank', 'hdfc', 'icici', 'axis', 'payu', 'mandate', 'ref', 'txn', 'payment',
    'neft', 'rtgs', 'imps', 'pos', 'autopay', 'com'
]);


export function normalizeMerchant(description: string): string {
    // 1. Lowercase text
    let normalized = description.toLowerCase();

    // 2. Remove numbers
    // 3. Remove transaction IDs (often alphanumeric chunks or long strings)
    // We'll replace any word that contains numbers with a space.
    normalized = normalized.replace(/\b[a-z0-9]*\d+[a-z0-9]*\b/g, ' ');

    // 4. Remove special characters (everything not a-z)
    normalized = normalized.replace(/[^a-z]/g, ' ');

    // 5. Remove generic words and UPI handles
    // Often UPI handles are suffix like @hdfcbank, @payu, @icici.
    // We replaced '@' with space, so they are just words now.
    const words = normalized.split(/\s+/);
    const cleanWords = words.filter(word => {
        if (word.length <= 1) return false; // remove single characters
        if (USER_GENERIC_WORDS.has(word)) return false;
        // We also remove handles specifically like 'okhdfcbank', 'okicici', 'ybl', 'ibl'
        if (['okhdfcbank', 'okicici', 'ybl', 'ibl', 'axl'].includes(word)) return false;
        return true;
    });

    // 6. Trim and collapse multiple spaces (handled by join(' '))
    return cleanWords.join(' ').trim();
}
