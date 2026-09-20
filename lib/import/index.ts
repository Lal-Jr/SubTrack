import { detectCsv, readGrid, type Detection, type Grid } from './csv';
import { parsePdfLines } from './pdf';
import type { ParseResult } from './types';

export * from './types';
export { parseAmount } from './amount';
export { parseDate, detectDateOrder } from './date';
export { detectCsv, extractCsv, readGrid, type Detection, type Grid } from './csv';
export { parsePdfLines } from './pdf';
export { dedupeKeys } from './dedupe';

export type LoadedStatement =
    | { kind: 'csv'; grid: Grid; detection: Detection }
    | { kind: 'pdf'; result: ParseResult };

/** Reads a statement file in the browser. Nothing is uploaded anywhere. */
export async function loadStatement(file: File): Promise<LoadedStatement> {
    const name = file.name.toLowerCase();
    if (file.type.includes('csv') || name.endsWith('.csv')) {
        const grid = readGrid(await file.text());
        if (grid.length === 0) throw new Error('The file is empty.');
        return { kind: 'csv', grid, detection: detectCsv(grid) };
    }
    if (file.type.includes('pdf') || name.endsWith('.pdf')) {
        // pdf.js is large and touches browser-only APIs, so load it on demand.
        const { extractPdfLines } = await import('./pdfExtract');
        const result = parsePdfLines(await extractPdfLines(file));
        if (result.transactions.length === 0) {
            throw new Error('No transactions could be read from this PDF. If it is a scanned image, export a CSV from your bank instead.');
        }
        return { kind: 'pdf', result };
    }
    throw new Error('Unsupported file type. Please choose a CSV or PDF file.');
}
