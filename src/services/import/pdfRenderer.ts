import * as pdfjs from 'pdfjs-dist/legacy/build/pdf';
import { createCanvas } from 'canvas';

export async function renderPdfPageToBuffer(pdfBuffer: Uint8Array, pageNumber: number, scale = 2.0): Promise<Buffer> {
  const doc = await (pdfjs as any).getDocument({ data: pdfBuffer, useSystemFonts: true, disableFontFace: true }).promise;
  const page = await doc.getPage(pageNumber);
  const vp = page.getViewport({ scale });
  const canvas = createCanvas(vp.width, vp.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context failed');
  await page.render({ canvasContext: ctx as any, viewport: vp }).promise;
  return canvas.toBuffer('image/jpeg', { quality: 95 });
}

export async function getPdfPageCount(pdfBuffer: Uint8Array): Promise<number> {
  const doc = await (pdfjs as any).getDocument({ data: pdfBuffer }).promise;
  return doc.numPages;
}
