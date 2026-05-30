// Resume text extraction (DESIGN.md §4). The extracted text becomes the AI
// context in Slice 3. pdfjs + its worker are loaded dynamically so the pure
// text-assembly helpers stay cheap to import (and unit-testable in jsdom).

interface TextItemLike {
  str: string;
  hasEOL?: boolean;
}

/** Concatenate pdf.js text items, breaking lines on end-of-line markers. */
export function joinItems(items: TextItemLike[]): string {
  let out = '';
  for (const item of items) {
    out += item.str + (item.hasEOL ? '\n' : ' ');
  }
  return out.trimEnd();
}

/** Tidy raw page text: collapse spaces, cap blank-line runs, trim. */
export function normalizePdfText(raw: string): string {
  return raw
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

let workerReady = false;

export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  if (!workerReady) {
    const PdfWorker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?worker')).default;
    pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker();
    workerReady = true;
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  try {
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const items: TextItemLike[] = content.items
        .filter((it) => 'str' in it)
        .map((it) => it as TextItemLike);
      pages.push(joinItems(items));
    }
    return normalizePdfText(pages.join('\n\n'));
  } finally {
    await doc.destroy();
  }
}
