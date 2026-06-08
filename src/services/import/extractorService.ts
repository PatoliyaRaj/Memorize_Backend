/**
 * Smart Import — File Extraction Service
 *
 * Security hardening applied:
 *  - sharp().threshold(160): Replaces .normalise() for IMAGE processing.
 *    .normalise() stretches contrast — could amplify hidden light-gray adversarial text.
 *    .threshold(160) binarizes: pixels < 160 → black, pixels ≥ 160 → white.
 *    Gray ink (#F0F0F0 = pixel value ~240) disappears to white mathematically.
 *    NOTE: processScannedPdf still uses .normalise() — printed content is not steganographic.
 *  - Vision API fallback chain: NVIDIA throws → catch → Tesseract → never 500 crash.
 *  - processMultipleFiles: sequential (not parallel) to prevent V8 RAM spikes.
 *
 * Processing route map:
 *   text/plain | text/markdown → fs.readFileSync
 *   docx                       → mammoth.extractRawText
 *   pdf (digital text ≥100 chars) → pdf-parse
 *   pdf (scanned)              → pdfjs-dist render → sharp.normalise → Tesseract
 *   image (handwritten mode)   → sharp.threshold → NVIDIA Vision (llama-4-maverick)
 *   image (auto, conf < 0.70)  → sharp.threshold → Tesseract → auto-escalate to NVIDIA
 *   image (printed/auto, ok)   → sharp.threshold → Tesseract
 *   multi-image (1-5 files)    → processFileSecurely × N, concatenated with PAGE separators
 */

import fs                         from 'fs';
import FileType                   from 'file-type';
import pdfParse = require('pdf-parse');
import Tesseract                  from 'tesseract.js';
import sharp                      from 'sharp';
import mammoth                    from 'mammoth';
import { renderPdfPageToBuffer, getPdfPageCount } from './pdfRenderer';
import { detectLanguageFromText, SupportedLang }  from './languageDetector';
import { extractTextFromImageNvidia }              from '../../lib/nvidia/visionService';

export interface ExtractionPayload {
  text:           string;
  detectedLang:   SupportedLang | 'auto';
  method:         string;
  confidence:     number;
  pageCount?:     number;
  /** Set when NVIDIA Vision returns a fully-parsed JSON payload (fast-path) */
  structuredJson?: { fields: any; cards: any[] };
}

/** Below this Tesseract confidence, auto-escalate to NVIDIA Vision */
const AUTO_ESCALATION_THRESHOLD = 0.70;

// ── Multi-File Entry Point ─────────────────────────────────────────────────

/**
 * Process 1–5 image files sequentially (memory-safe, no parallel V8 spike).
 * Concatenates extracted text with --- PAGE N --- separators.
 */
export async function processMultipleFiles(
  filePaths:    string[],
  imageQuality?: 'printed' | 'handwritten' | 'auto',
): Promise<ExtractionPayload> {
  if (filePaths.length === 1) {
    return processFileSecurely(filePaths[0], imageQuality);
  }

  let combinedText    = '';
  let totalConfidence = 0;
  const methods: string[] = [];

  for (let i = 0; i < filePaths.length; i++) {
    const result = await processFileSecurely(filePaths[i], imageQuality);
    combinedText    += `\n\n--- PAGE ${i + 1} ---\n${result.text}`;
    totalConfidence += result.confidence;
    methods.push(result.method);
  }

  return {
    text:         combinedText.trim(),
    detectedLang: detectLanguageFromText(combinedText),
    method:       `${methods[0]}-multi-page`,
    confidence:   totalConfidence / filePaths.length,
    pageCount:    filePaths.length,
  };
}

// ── Single File Entry Point ────────────────────────────────────────────────

export async function processFileSecurely(
  filePath:      string,
  imageQuality?: 'printed' | 'handwritten' | 'auto',
  _nodeTitle?:   string, // Reserved for future context-aware extraction
  _nodeType?:    string,
): Promise<ExtractionPayload> {
  const ft   = await FileType.fromFile(filePath);
  const mime = ft?.mime ?? guessFromExtension(filePath);

  // ── Plain text / Markdown ────────────────────────────────────────────────
  if (mime === 'text/plain' || mime === 'text/markdown') {
    const text = fs.readFileSync(filePath, 'utf-8');
    return { text, detectedLang: detectLanguageFromText(text), method: 'plain-text', confidence: 1.0 };
  }

  // ── Word Document ────────────────────────────────────────────────────────
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const buf    = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer: buf });
    return { text: result.value, detectedLang: detectLanguageFromText(result.value), method: 'docx', confidence: 0.99 };
  }

  // ── PDF ──────────────────────────────────────────────────────────────────
  if (mime === 'application/pdf') {
    const buf     = fs.readFileSync(filePath);
    const digital = await pdfParse(buf);
    // Use digital text if it has substantial content (≥100 non-whitespace chars)
    if (digital.text && digital.text.replace(/\s/g, '').length >= 100) {
      return { text: digital.text, detectedLang: detectLanguageFromText(digital.text), method: 'pdf-digital', confidence: 0.99 };
    }
    // Otherwise it's a scanned PDF — render to images and OCR each page
    return processScannedPdf(buf);
  }

  // ── Image ────────────────────────────────────────────────────────────────
  if (mime.startsWith('image/')) {
    return processSingleImage(filePath, imageQuality);
  }

  throw new Error(`Unsupported file type: ${mime}`);
}

// ── Scanned PDF Pipeline ───────────────────────────────────────────────────

async function processScannedPdf(pdfBuffer: Buffer): Promise<ExtractionPayload> {
  const pageCount = await getPdfPageCount(pdfBuffer);
  const maxPages  = Math.min(pageCount, 15); // Cap at 15 pages to control processing time
  let text        = '';
  let totalConf   = 0;

  for (let p = 1; p <= maxPages; p++) {
    const imgBuf = await renderPdfPageToBuffer(pdfBuffer, p, 2.0);

    // NOTE: scanned PDFs use .normalise() (NOT .threshold()) because the content
    // is structured/printed — we want contrast enhancement for better OCR.
    // threshold(160) is reserved for direct image uploads where steganography is a risk.
    const pre = await sharp(imgBuf)
      .resize({ width: 2200, withoutEnlargement: true })
      .greyscale()
      .normalise()
      .toBuffer();

    const sample = await Tesseract.recognize(pre, 'eng');
    const lang   = detectLanguageFromText(sample.data.text);
    let resultText = sample.data.text;
    let resultConf = sample.data.confidence;

    if (lang !== 'eng') {
      const result = await Tesseract.recognize(pre, mapTess(lang));
      resultText = result.data.text;
      resultConf = result.data.confidence;
    }

    text      += `\n--- PAGE ${p} ---\n${resultText}`;
    totalConf += resultConf / 100;
  }

  return {
    text,
    detectedLang: detectLanguageFromText(text),
    method:       'pdf-scanned-ocr',
    confidence:   totalConf / maxPages,
    pageCount:    maxPages,
  };
}

// ── Single Image Pipeline ──────────────────────────────────────────────────

async function processSingleImage(
  filePath: string,
  quality?: 'printed' | 'handwritten' | 'auto',
): Promise<ExtractionPayload> {
  const buf = fs.readFileSync(filePath);

  /**
   * SECURITY FIX — threshold(160) instead of normalise():
   *   .normalise() stretches the contrast histogram, which could amplify
   *   hidden light-gray adversarial text injected into an uploaded image.
   *   .threshold(160) binarizes: pixels < 160 → black, pixels ≥ 160 → white.
   *   Gray ink (#F0F0F0 = pixel value ~240) disappears to pure white.
   *   This mathematically destroys steganographic injection attacks.
   */
  const pre = await sharp(buf)
    .resize({ width: 2000, withoutEnlargement: true })
    .greyscale()
    .threshold(160)           // ← SECURITY: binarize instead of stretch
    .jpeg({ quality: 95 })
    .toBuffer();

  // ── Explicit handwriting mode → NVIDIA Vision directly ──────────────────
  if (quality === 'handwritten' && process.env.NVIDIA_NIM_API_KEY) {
    try {
      const r = await extractTextFromImageNvidia(pre.toString('base64'), 'image/jpeg');
      return {
        text:         r.text,
        detectedLang: detectLanguageFromText(r.text),
        method:       'nvidia-vision-handwriting',
        confidence:   r.confidence,
      };
    } catch (visionErr) {
      // ROBUSTNESS: Vision API failure NEVER crashes the server.
      // Gracefully fall through to Tesseract.
      console.warn('[VISION SERVICE] NVIDIA API failed, falling back to Tesseract:', (visionErr as Error).message);
      return executeTesseractFallback(pre, 'tesseract-fallback-vision-failed');
    }
  }

  // ── Auto / printed mode → Tesseract first, escalate if needed ───────────
  const sample = await Tesseract.recognize(pre, 'eng');
  const lang   = detectLanguageFromText(sample.data.text);
  let mainText = sample.data.text;
  let conf     = sample.data.confidence / 100;

  if (lang !== 'eng') {
    const main = await Tesseract.recognize(pre, mapTess(lang));
    mainText = main.data.text;
    conf     = main.data.confidence / 100;
  }

  // Auto-escalate to Vision if Tesseract confidence is below threshold
  if (conf < AUTO_ESCALATION_THRESHOLD && process.env.NVIDIA_NIM_API_KEY) {
    try {
      const r = await extractTextFromImageNvidia(pre.toString('base64'), 'image/jpeg');
      return {
        text:         r.text,
        detectedLang: detectLanguageFromText(r.text),
        method:       'nvidia-vision-auto-escalated',
        confidence:   r.confidence,
      };
    } catch (visionErr) {
      // Vision fallback also failed — return best Tesseract result we have
      console.warn('[VISION FALLBACK] API call failed, using Tesseract output:', (visionErr as Error).message);
    }
  }

  return {
    text:         mainText,
    detectedLang: lang,
    method:       `tesseract-${mapTess(lang)}`,
    confidence:   conf,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function executeTesseractFallback(
  preprocessedBuffer: Buffer,
  methodLabel: string,
): Promise<ExtractionPayload> {
  const sample = await Tesseract.recognize(preprocessedBuffer, 'eng');
  const lang   = detectLanguageFromText(sample.data.text);
  let mainText = sample.data.text;
  let conf     = sample.data.confidence / 100;

  if (lang !== 'eng') {
    const main = await Tesseract.recognize(preprocessedBuffer, mapTess(lang));
    mainText = main.data.text;
    conf     = main.data.confidence / 100;
  }

  return {
    text:         mainText,
    detectedLang: lang,
    method:       methodLabel,
    confidence:   conf,
  };
}

function mapTess(lang: SupportedLang | 'auto'): string {
  const map: Record<string, string> = { eng: 'eng', hin: 'hin', guj: 'guj' };
  return map[lang] ?? 'eng';
}

function guessFromExtension(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    pdf:  'application/pdf',
    jpg:  'image/jpeg',
    jpeg: 'image/jpeg',
    png:  'image/png',
    webp: 'image/webp',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt:  'text/plain',
    md:   'text/markdown',
  };
  return map[ext ?? ''] ?? 'application/octet-stream';
}
