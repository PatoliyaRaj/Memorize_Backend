import fs from 'fs';
import FileType from 'file-type';
import pdfParse = require('pdf-parse');
import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import mammoth from 'mammoth';
import { renderPdfPageToBuffer, getPdfPageCount } from './pdfRenderer';
import { detectLanguageFromText, SupportedLang } from './languageDetector';
import { extractTextFromImageNvidia } from '../../lib/nvidia/visionService';

export interface ExtractionPayload { text: string; detectedLang: SupportedLang; method: string; confidence: number; }

const CONFIDENCE_THRESHOLD = 0.72;

export async function processFileSecurely(filePath: string, imageQuality?: 'printed' | 'handwritten' | 'auto'): Promise<ExtractionPayload> {
  const ft = await FileType.fromFile(filePath);

  // Fallback for .txt / .md which may not have magic bytes
  const mime = ft?.mime ?? guessFromExtension(filePath);

  // ── Plain text / Markdown ──────────────────────────────────────────
  if (mime === 'text/plain' || mime === 'text/markdown') {
    const text = fs.readFileSync(filePath, 'utf-8');
    return { text, detectedLang: detectLanguageFromText(text), method: 'plain-text', confidence: 1.0 };
  }

  // ── Word Document ──────────────────────────────────────────────────
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value, detectedLang: detectLanguageFromText(result.value), method: 'docx', confidence: 0.99 };
  }

  // ── PDF ────────────────────────────────────────────────────────────
  if (mime === 'application/pdf') {
    const buf = fs.readFileSync(filePath);
    const digital = await pdfParse(buf);
    if (digital.text && digital.text.replace(/\s/g, '').length >= 100) {
      return { text: digital.text, detectedLang: detectLanguageFromText(digital.text), method: 'pdf-digital', confidence: 0.99 };
    }
    return processScannedPdf(buf);
  }

  // ── Image ──────────────────────────────────────────────────────────
  if (mime.startsWith('image/')) return processSingleImage(filePath, imageQuality);

  throw new Error(`Unsupported file type: ${mime}`);
}

async function processScannedPdf(pdfBuffer: Buffer): Promise<ExtractionPayload> {
  const pageCount = await getPdfPageCount(pdfBuffer);
  const max = Math.min(pageCount, 15);
  let text = '', confidence = 0;
  for (let p = 1; p <= max; p++) {
    const img = await renderPdfPageToBuffer(pdfBuffer, p, 2.0);
    const pre = await sharp(img).resize({ width: 2200, withoutEnlargement: true }).greyscale().normalise().toBuffer();
    const sample = await Tesseract.recognize(pre, 'eng');
    const lang = detectLanguageFromText(sample.data.text);
    const result = await Tesseract.recognize(pre, mapTess(lang));
    text += `\n--- PAGE ${p} ---\n${result.data.text}`;
    confidence += result.data.confidence / 100;
  }
  return { text, detectedLang: detectLanguageFromText(text), method: 'pdf-scanned-ocr', confidence: confidence / max };
}

async function processSingleImage(filePath: string, quality?: 'printed' | 'handwritten' | 'auto'): Promise<ExtractionPayload> {
  const buf = fs.readFileSync(filePath);
  const pre = await sharp(buf).resize({ width: 2000, withoutEnlargement: true }).greyscale().normalise().jpeg({ quality: 95 }).toBuffer();

  if (quality === 'handwritten' && process.env.NVIDIA_NIM_API_KEY) {
    const r = await extractTextFromImageNvidia(pre.toString('base64'), 'image/jpeg');
    return { text: r.text, detectedLang: detectLanguageFromText(r.text), method: 'nvidia-vision-handwriting', confidence: r.confidence };
  }

  const sample = await Tesseract.recognize(pre, 'eng');
  const lang = detectLanguageFromText(sample.data.text);
  const main = await Tesseract.recognize(pre, mapTess(lang));
  const conf = main.data.confidence / 100;

  if (conf < CONFIDENCE_THRESHOLD && process.env.NVIDIA_NIM_API_KEY) {
    const r = await extractTextFromImageNvidia(pre.toString('base64'), 'image/jpeg');
    return { text: r.text, detectedLang: detectLanguageFromText(r.text), method: 'nvidia-vision-fallback', confidence: r.confidence };
  }

  return { text: main.data.text, detectedLang: lang, method: `tesseract-${mapTess(lang)}`, confidence: conf };
}

function mapTess(lang: SupportedLang): string { return lang === 'hin' ? 'hin' : lang === 'guj' ? 'guj' : 'eng'; }
function guessFromExtension(p: string): string {
  if (p.endsWith('.txt') || p.endsWith('.md')) return 'text/plain';
  if (p.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return 'application/octet-stream';
}
