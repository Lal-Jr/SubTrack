import Papa from 'papaparse';

// Declare types for PDF.js to avoid direct heavy imports if injected/dynamic
// In Next.js, PDF.js must be loaded dynamically on the client side to bypass DOMMatrix SSR errors.
type PdfJsLib = any;

// ============================================================================
// Types
// ============================================================================

export type Transaction = {
    date: string;              // ISO string (YYYY-MM-DD)
    description: string;
    amount: number;            // negative = debit, positive = credit
    rawAmount: number;         // original parsed number
    type: "debit" | "credit";
};

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Parses a bank statement file (CSV or PDF) into a normalized Transaction array.
 * Runs completely in the browser.
 */
export async function parseStatement(file: File): Promise<Transaction[]> {
    const type = file.type.toLowerCase();
    const name = file.name.toLowerCase();

    if (type.includes('csv') || name.endsWith('.csv')) {
        return parseCSV(file);
    } else if (type.includes('pdf') || name.endsWith('.pdf')) {
        return parsePDF(file);
    } else {
        throw new Error('Unsupported file type. Please upload a CSV or PDF file.');
    }
}

// ============================================================================
// CSV Parsing
// ============================================================================

async function parseCSV(file: File): Promise<Transaction[]> {
    return new Promise((resolve, reject) => {
        Papa.parse<string[]>(file, {
            skipEmptyLines: true,
            // We read as 2D array instead of header-keyed objects because bank CSV headers 
            // are often wildly inconsistent or preceded by random metadata rows.
            complete: (results) => {
                try {
                    const transactions = extractTransactionsFromGrid(results.data);
                    resolve(transactions);
                } catch (error) {
                    reject(error);
                }
            },
            error: (error) => reject(new Error(`CSV Parsing failed: ${error.message}`))
        });
    });
}

/**
 * Scans a 2D array of strings (from CSV) and attempts to find the date, description,
 * withdrawal, and deposit columns to extract valid transactions.
 */
function extractTransactionsFromGrid(rows: string[][]): Transaction[] {
    const transactions: Transaction[] = [];

    // 1. Identify header row indices
    let dateHeaderIdx = -1;
    let descHeaderIdx = -1;
    let withHeaderIdx = -1;
    let depHeaderIdx = -1;
    let amountHeaderIdx = -1; // If a single signed amount column exists
    let startRowIdx = 0;

    for (let i = 0; i < Math.min(rows.length, 20); i++) {
        const row = rows[i].map(c => c.toLowerCase().trim());

        dateHeaderIdx = row.findIndex(c => c.includes('date'));
        descHeaderIdx = row.findIndex(c => c.includes('narration') || c.includes('description') || c.includes('particulars'));
        withHeaderIdx = row.findIndex(c => c.includes('withdrawal') || c.includes('debit'));
        depHeaderIdx = row.findIndex(c => c.includes('deposit') || c.includes('credit'));
        amountHeaderIdx = row.findIndex(c => c === 'amount' || c === 'amount (inr)');

        if (dateHeaderIdx !== -1 && descHeaderIdx !== -1 && ((withHeaderIdx !== -1 && depHeaderIdx !== -1) || amountHeaderIdx !== -1)) {
            startRowIdx = i + 1; // Start reading data from the next row
            break;
        }
    }

    // If we couldn't confidently find headers, try brute-force parsing rows that look like transactions
    const bruteForce = startRowIdx === 0;

    for (let i = startRowIdx; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 3) continue;

        let rawDate = '';
        let description = '';
        let withStr = '';
        let depStr = '';
        let amountStr = '';

        if (!bruteForce) {
            rawDate = row[dateHeaderIdx] || '';
            description = row[descHeaderIdx] || '';
            if (withHeaderIdx !== -1) withStr = row[withHeaderIdx];
            if (depHeaderIdx !== -1) depStr = row[depHeaderIdx];
            if (amountHeaderIdx !== -1) amountStr = row[amountHeaderIdx];
        } else {
            // Brute force: assume col 0 is date, col 1 is description, and look for numbers in the rest
            rawDate = row[0];
            description = row[1];
            // Search for the first valid formatted number
            for (let j = 2; j < row.length; j++) {
                const val = cleanAmount(row[j]);
                if (val !== null && val !== 0) {
                    amountStr = row[j]; // Naive guess: First number is a single signed amount
                    break;
                }
            }
        }

        const isoDate = normalizeDate(rawDate);
        if (!isoDate) continue; // Skip invalid rows (e.g. footers)

        // Calculate final amount
        let finalAmount = 0;

        if (amountStr) {
            finalAmount = cleanAmount(amountStr) || 0;
        } else {
            const withdrawal = cleanAmount(withStr) || 0;
            const deposit = cleanAmount(depStr) || 0;
            // Withdrawals are negative, Deposits are positive
            if (withdrawal > 0) finalAmount -= withdrawal;
            if (deposit > 0) finalAmount += deposit;
        }

        if (finalAmount === 0) continue; // Ignore nil transactions

        transactions.push({
            date: isoDate,
            description: description.trim(),
            amount: finalAmount,
            rawAmount: Math.abs(finalAmount),
            type: finalAmount < 0 ? 'debit' : 'credit'
        });
    }

    return transactions;
}

// ============================================================================
// PDF Parsing (HDFC Tabular Focus)
// ============================================================================

/**
 * Dynamically loads pdfjs-dist and parses PDF text.
 * Requires pdf.worker.min.mjs to be accessible at /pdf.worker.min.mjs
 */
async function parsePDF(file: File): Promise<Transaction[]> {
    try {
        // Dynamic import to avoid Next.js SSR Canvas/DOMMatrix crashes
        const pdfjsLib: PdfJsLib = await import('pdfjs-dist');
        if (typeof window !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        const allTextLines: string[] = [];

        // Extract text grouped by Y-coordinate across all pages
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();

            const linesMap: Record<number, string[]> = {};

            textContent.items.forEach((item: any) => {
                if (item.str && item.str.trim() !== '') {
                    // Group horizontally by Y coordinate (rounded to 5 units to handle slight misalignments)
                    const y = Math.round(item.transform[5] / 5) * 5;
                    if (!linesMap[y]) linesMap[y] = [];
                    linesMap[y].push(item.str.trim());
                }
            });

            // Sort Y descending (top to bottom reading)
            const sortedY = Object.keys(linesMap).map(Number).sort((a, b) => b - a);

            for (const y of sortedY) {
                const line = linesMap[y].join(' ').replace(/\s{2,}/g, ' ').trim();
                allTextLines.push(line);
            }
        }

        return extractTransactionsFromPDFText(allTextLines);

    } catch (error: any) {
        throw new Error(`PDF Parsing failed: ${error.message}`);
    }
}

/**
 * Parses sequential text lines extracted from a PDF.
 * Specifically handles the HDFC-style layout:
 * Date | Narration | Ref No | Value Date | Withdrawal | Deposit | Closing Balance
 */
function extractTransactionsFromPDFText(lines: string[]): Transaction[] {
    const transactions: Transaction[] = [];

    // Match standard Indian/Global bank dates: DD/MM/YY or DD/MM/YYYY or DD-MM-YY
    const dateStrRegex = /^(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})/;

    let currentRowText = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // If a line starts with a Date, it is the start of a new transaction row
        if (dateStrRegex.test(line)) {
            // Process pending row if we have one
            if (currentRowText) {
                const txn = processPDFRow(currentRowText);
                if (txn) transactions.push(txn);
            }
            currentRowText = line; // Start accumulating new row
        } else {
            // If it doesn't start with a date, it might be a wrapped multi-line narration
            if (currentRowText.length > 0) {
                // Exclude generic header/footer lines from messing up the narration
                const lowerLine = line.toLowerCase();
                if (!lowerLine.includes('page') && !lowerLine.includes('statement of account')) {
                    currentRowText += ' ' + line;
                }
            }
        }
    }

    // Process the last accumulated row
    if (currentRowText) {
        const txn = processPDFRow(currentRowText);
        if (txn) transactions.push(txn);
    }

    return transactions;
}

/**
 * Strategy for parsing a single contiguous HDFC-style text string:
 * Format: 01/01/25 UPI-ZOMATO... 123456789 01/01/25 150.00 0.00 1,500.00
 * Or:     01/01/25 SALARY DEPOSIT 123456789 01/01/25 50000.00 51,500.00
 */
function processPDFRow(rawRow: string): Transaction | null {
    const parts = rawRow.split(/\s+/);
    if (parts.length < 4) return null;

    // 1. Date is always first
    const rawDate = parts[0];
    const isoDate = normalizeDate(rawDate);
    if (!isoDate) return null;

    // Bank statements usually end with 3 numbers: Withdrawal, Deposit, ClosingBalance
    // If only 2 numbers fit the pattern at the end: Amount, ClosingBalance
    // We scan the array backwards to find the numbers.

    let closingBalance = 0;
    let depositAmount = 0;
    let withdrawalAmount = 0;
    let singleSignedAmount = 0; // If layout lacks Deposit/Withdrawal split

    let numericTokensFound = 0;
    let numericTokens: number[] = [];

    // Slice off the end looking for valid numbers
    let descIndexEnd = parts.length;

    for (let i = parts.length - 1; i >= 1; i--) {
        const token = parts[i];
        // A strict number check to avoid catching reference numbers like "12345678"
        // Valid monetary amounts usually have decimals ".00"
        if (/^[\(\)]?[\d,]+\.\d{2}[\(\)]?$/.test(token)) {
            numericTokens.unshift(cleanAmount(token) || 0);
            numericTokensFound++;
            descIndexEnd = i;
        } else if (dateStrRegexSafe.test(token)) {
            // Value Date (e.g. 01/01/25) found near the end, stop searching for numbers.
            descIndexEnd = i;
            break;
        } else {
            // If we hit a non-number and non-date at the end of the string, stop looking for trailing numbers
            if (numericTokensFound > 0) break;
        }
    }

    // HDFC specifics: Withdrawals and Deposits often printed as: Withdrawal Deposit ClosingBalance
    // e.g., 20.00 0.00 100.00 -> withdrawal=20, dep=0, cb=100
    // Often empty columns are completely collapsed by parser: e.g. 20.00 100.00 (Widthdrawal=20, CB=100)
    // PDF extractors don't retain spatial gaps.

    let finalAmount = 0;

    if (numericTokens.length >= 2) {
        // We assume the last number is Closing Balance.
        // The number before that is either Deposit or Withdrawal.
        // HDFC usually prints both, or drops the zero.
        // We'll trust the HDFC layout: Withdrawal is before Deposit.
        // To reliably detect without spatial info, we'd need to compare Closing Balance to Previous Closing Balance
        // As a heuristic for single-transaction rows without Context:
        // If length == 3: [Withdrawal, Deposit, CB]
        // If length == 2: [Amount, CB]. We guess based on standard debits, or fall back to naive deposit/withdrawal determination missing context.

        // Let's use a simpler heuristic for general PDF formats: Ignore closing balance. Look at the magnitude or just accept signed values.

        if (numericTokens.length === 3) {
            withdrawalAmount = numericTokens[0];
            depositAmount = numericTokens[1];
        } else {
            // 2 tokens: Amount and CB. We need structural context to know if debit/credit.
            // PDF parsers without spatial data make this very hard. 
            // We will assume it's a Withdrawal if it's the standard debit-heavy user flow, 
            // unless the description says "SALARY", "REFUND", "NEFT/CREDIT".
            const isLikelyCredit = /SALARY|CREDIT|REFUND|REVERSAL|INTEREST/.test(rawRow.toUpperCase());
            if (isLikelyCredit) {
                depositAmount = numericTokens[0];
            } else {
                withdrawalAmount = numericTokens[0];
            }
        }

        if (withdrawalAmount > 0) finalAmount -= withdrawalAmount;
        if (depositAmount > 0) finalAmount += depositAmount;

    } else if (numericTokens.length === 1) {
        // Just one number? We'll assume it's the amount.
        finalAmount = numericTokens[0]; // Wait, we don't know the sign.
        if (finalAmount > 0) finalAmount = -Math.abs(finalAmount); // Default to debit for safety
    }

    if (finalAmount === 0 || !isValidTransactionRow(rawRow)) return null;

    // The description is everything between the first Date and the trailing dates/numbers
    const descriptionTokens = parts.slice(1, descIndexEnd);

    // Clean trailing reference numbers from description
    const cleanDesc = descriptionTokens.filter(t => !/^\d{6,}$/.test(t) && !dateStrRegexSafe.test(t)).join(' ');

    return {
        date: isoDate,
        description: cleanDesc.trim() || "UNKNOWN TXN",
        amount: finalAmount,
        rawAmount: Math.abs(finalAmount),
        type: finalAmount < 0 ? 'debit' : 'credit'
    };
}

const dateStrRegexSafe = /^(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})/;

// ============================================================================
// Data Cleaning & Helpers
// ============================================================================

/**
 * Converts formatted currency strings to a valid number.
 * "1,234.00" -> 1234
 * "(199.00)" -> -199
 * "-50.0" -> -50
 */
function cleanAmount(val: string | undefined): number | null {
    if (!val) return null;
    // Remove spaces and currency symbols
    let cleanStr = val.replace(/[\s₹$,Rs]/g, '').trim();

    // Handle (number) as negative accounting format
    let isNegative = false;
    if (cleanStr.startsWith('(') && cleanStr.endsWith(')')) {
        isNegative = true;
        cleanStr = cleanStr.slice(1, -1);
    } else if (cleanStr.startsWith('-') || cleanStr.endsWith('Cr')) {
        isNegative = true;
        cleanStr = cleanStr.replace(/[-Cr]/g, '');
    }

    // Remove thousand separators
    cleanStr = cleanStr.replace(/,/g, '');

    const amount = parseFloat(cleanStr);
    if (isNaN(amount)) return null;

    return isNegative ? -amount : amount;
}

/**
 * Normalizes common Indian DB dates (DD/MM/YYYY or DD/MM/YY) into ISO YYYY-MM-DD.
 * Returns null if invalid.
 */
function normalizeDate(dateStr: string | undefined): string | null {
    if (!dateStr) return null;

    const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
    if (parts.length !== 3) return null;

    let year = parseInt(parts[2]);
    if (year < 100) year += 2000; // yy to yyyy

    // Detect DD/MM vs MM/DD
    // Many bank statements in India use DD/MM
    let day = parseInt(parts[0]);
    let month = parseInt(parts[1]);

    // Fallback heuristic
    if (month > 12) {
        // Oops, it must be MM/DD
        month = parseInt(parts[0]);
        day = parseInt(parts[1]);
    }

    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    // ISO string pad
    const mStr = month.toString().padStart(2, '0');
    const dStr = day.toString().padStart(2, '0');

    return `${year}-${mStr}-${dStr}`;
}

/**
 * Ensures the row has at least some alphanumeric description characters to avoid 
 * phantom rows composed entirely of dashes or empty columns.
 */
function isValidTransactionRow(rawRow: string): boolean {
    if (!rawRow || rawRow.trim().length === 0) return false;
    // Make sure there are some actual text characters (not just numbers/symbols)
    return /[a-zA-Z]{3,}/.test(rawRow);
}

// =========================================================================
// Example Usage Snippet (React/Next.js Component)
// =========================================================================
/*
import { parseStatement } from '@/lib/statementParser';

export default function StatementUploader() {
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const transactions = await parseStatement(file);
      console.log("Parsed Transactions:", transactions);
      
      // Feed these directly into detectRecurringSubscriptions(transactions)
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  };

  return (
    <input type="file" accept=".csv,.pdf" onChange={handleUpload} />
  );
}
*/
