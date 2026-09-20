import { parseAmount } from './amount';
import { parseDate } from './date';
import type { DateOrder, ParseResult, ParsedTransaction } from './types';

/**
 * Turns the text lines of a bank statement PDF into transactions. Pure: PDF text extraction
 * lives in pdfExtract.ts. Rows start with a date and end with money columns
 * (withdrawal / deposit / balance, or amount / balance).
 */

const START_DATE = /^(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}[-/ ][A-Za-z]{3,9}[-/ ,]+\d{2,4})(?=\s|$)/;
const MONEY = /^[(]?-?[\d,]+\.\d{2}[)]?(cr|dr)?$/i;
const DATE_TOKEN = /^(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}-\d{2}-\d{2})$/;
// Lines that end a transaction row instead of continuing its narration.
const BOUNDARY = /(opening balance|closing balance|statement summary|total (debit|credit)|page \d|page no|statement of account|generated on|end of statement)/i;
const LIKELY_CREDIT = /\b(salary|refund|reversal|interest paid|cashback|deposit|credit interest)\b/i;

interface Row {
    date: string;
    description: string;
    /** Signed if the statement said so (Dr/Cr suffix or separate withdrawal/deposit columns). */
    signed: number | null;
    /** Unsigned amount when only an amount+balance pair was printed. */
    amount: number | null;
    balance: number | null;
}

function parseRow(text: string, order: DateOrder): Row | null {
    // "1,234.00 Dr" -> "1,234.00Dr" so the suffix stays with its number.
    const parts = text.replace(/(\d)\s+(cr|dr)\b/gi, '$1$2').split(/\s+/);
    const dateMatch = START_DATE.exec(text);
    if (!dateMatch) return null;
    const date = parseDate(dateMatch[1], order);
    if (!date) return null;

    const dateTokenCount = dateMatch[1].split(/\s+/).length;
    const body = parts.slice(dateTokenCount);

    // Money columns form a contiguous run of amounts. Wrapped narration can trail after it,
    // so take the last run of two or more amounts (or the last single amount if there is none).
    const runs: { start: number; end: number }[] = [];
    for (let i = 0; i < body.length; i++) {
        if (!MONEY.test(body[i])) continue;
        const start = i;
        while (i + 1 < body.length && MONEY.test(body[i + 1])) i++;
        runs.push({ start, end: i + 1 });
    }
    const run = [...runs].reverse().find((r) => r.end - r.start >= 2) ?? runs[runs.length - 1];
    if (!run) return null;
    const money = body.slice(run.start, run.end).map((t) => parseAmount(t));
    if (money.some((v) => v === null)) return null;
    const nums = money as number[];
    const end = run.start;

    const description = [...body.slice(0, run.start), ...body.slice(run.end)]
        .filter((t) => !DATE_TOKEN.test(t) && !/^\d{6,}$/.test(t))
        .join(' ')
        .trim();
    if (!/[a-zA-Z]{3,}/.test(description)) return null;

    const hasSuffix = /(cr|dr)$/i.test(body[end] ?? '');
    if (nums.length >= 3) {
        // withdrawal, deposit, balance
        const [w, d, bal] = nums.slice(-3);
        const signed = Math.abs(w) > 0 ? -Math.abs(w) : Math.abs(d) > 0 ? Math.abs(d) : 0;
        return signed ? { date, description, signed, amount: null, balance: bal } : null;
    }
    if (nums.length === 2) {
        return { date, description, signed: hasSuffix ? nums[0] : null, amount: Math.abs(nums[0]), balance: nums[1] };
    }
    return { date, description, signed: hasSuffix || nums[0] < 0 ? nums[0] : null, amount: Math.abs(nums[0]), balance: null };
}

export function parsePdfLines(lines: string[], order: DateOrder = 'dmy'): ParseResult {
    // 1. Group lines into rows: a date starts a row, following lines are wrapped narration.
    const texts: string[] = [];
    let current = '';
    for (const line of lines) {
        if (START_DATE.test(line) && !BOUNDARY.test(line)) {
            if (current) texts.push(current);
            current = line;
        } else if (BOUNDARY.test(line)) {
            if (current) texts.push(current);
            current = '';
        } else if (current) {
            current += ' ' + line;
        }
    }
    if (current) texts.push(current);

    const rows = texts.map((t) => parseRow(t, order)).filter((r): r is Row => r !== null);

    // 2. Decide debit vs credit for amount+balance rows from how the running balance moved.
    // Statements list oldest-first or newest-first, so test both directions and keep the better one.
    const pairs = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.balance !== null && r.amount !== null && r.signed === null);
    const agree = (dir: 1 | -1) =>
        pairs.filter(({ r, i }) => {
            const neighbour = rows[i - dir];
            return neighbour?.balance != null && Math.abs(r.balance! - neighbour.balance) === r.amount;
        }).length;
    const forward = agree(1);
    const reverse = agree(-1);
    const dir: 1 | -1 = forward >= reverse ? 1 : -1;

    let guessed = 0;
    const transactions: ParsedTransaction[] = [];
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        let amount = r.signed;
        if (amount === null) {
            const neighbour = rows[i - dir];
            if (r.balance !== null && neighbour?.balance != null && Math.abs(r.balance - neighbour.balance) === r.amount) {
                amount = r.balance > neighbour.balance ? r.amount! : -r.amount!;
            } else {
                guessed++;
                amount = LIKELY_CREDIT.test(r.description) ? r.amount! : -r.amount!;
            }
        }
        if (amount) transactions.push({ date: r.date, description: r.description, amountMinor: amount });
    }

    const warnings: string[] = [];
    if (guessed) {
        warnings.push(`${guessed} row(s) could not be checked against the running balance, so debit/credit was guessed from the description. Please review.`);
    }
    return { transactions, warnings };
}
