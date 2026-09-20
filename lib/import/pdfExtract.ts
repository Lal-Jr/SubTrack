/** Browser-only: reads the text of a PDF into visual lines. pdf.js parses in its own web worker. */
export async function extractPdfLines(file: File): Promise<string[]> {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

    let pdf;
    try {
        pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    } catch (e) {
        if ((e as { name?: string }).name === 'PasswordException') {
            throw new Error('This PDF is password protected. Remove the password and try again.');
        }
        throw new Error('This PDF could not be opened.');
    }

    const lines: string[] = [];
    for (let p = 1; p <= pdf.numPages; p++) {
        const content = await (await pdf.getPage(p)).getTextContent();
        const items = content.items
            .filter((i): i is typeof i & { str: string; transform: number[] } => 'str' in i && i.str.trim() !== '')
            .map((i) => ({ text: i.str.trim(), x: i.transform[4], y: i.transform[5] }));

        // Group into visual lines by y (top to bottom), tolerating small misalignment, then read left to right.
        items.sort((a, b) => b.y - a.y || a.x - b.x);
        const page: { y: number; parts: { x: number; text: string }[] }[] = [];
        for (const it of items) {
            const line = page.find((l) => Math.abs(l.y - it.y) <= 3);
            if (line) line.parts.push({ x: it.x, text: it.text });
            else page.push({ y: it.y, parts: [{ x: it.x, text: it.text }] });
        }
        for (const l of page) lines.push(l.parts.sort((a, b) => a.x - b.x).map((x) => x.text).join(' '));
    }
    return lines;
}
