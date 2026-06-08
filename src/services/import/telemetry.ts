/**
 * Import Pipeline Telemetry
 *
 * PRIVACY: Only anonymized metrics are logged — never raw student notes.
 * The contentHash is a SHA-256 hash of the input text — useful for
 * detecting duplicate imports without storing the actual content.
 *
 * Safe to forward to Datadog, CloudWatch, or any log aggregator.
 */

import { createHash } from 'crypto';
import { SupportedLang } from './languageDetector';

interface ImportMetrics {
  method:              string;
  detectedLang:        SupportedLang | 'auto';
  confidence:          number;
  totalTimeMs:         number;
  extractionTimeMs:    number;
  orchestrationTimeMs: number;
  fileSizeByte:        number;
  pageCount:           number;
  chunkCount:          number;
}

/**
 * Log a structured JSON event for every completed import.
 * rawText is hashed for deduplication analytics — never stored as-is.
 */
export function logExtractionMetrics(
  userId:   string,
  nodeId:   string,
  metrics:  ImportMetrics,
  rawText?: string,
): void {
  const contentHash = rawText
    ? createHash('sha256').update(rawText).digest('hex').slice(0, 16) // First 16 chars sufficient for dedup
    : 'text-not-provided';

  const event = {
    timestamp:           new Date().toISOString(),
    event:               'smart_import_completed',
    userId,
    nodeId,
    contentHash,         // Anonymized fingerprint — NOT the actual text
    method:              metrics.method,
    detectedLang:        metrics.detectedLang,
    confidence:          Math.round(metrics.confidence * 100) / 100,
    totalTimeMs:         Math.round(metrics.totalTimeMs),
    extractionTimeMs:    Math.round(metrics.extractionTimeMs),
    orchestrationTimeMs: Math.round(metrics.orchestrationTimeMs),
    fileSizeByte:        metrics.fileSizeByte,
    pageCount:           metrics.pageCount,
    chunkCount:          metrics.chunkCount,
  };

  console.log(JSON.stringify(event));
}

/** Log a language detection event for script distribution analytics */
export function logLanguageDetection(
  userId:       string,
  nodeId:       string,
  detectedLang: string,
  confidence:   number,
): void {
  console.log(JSON.stringify({
    timestamp:    new Date().toISOString(),
    event:        'language_detection',
    userId,
    nodeId,
    detectedLang,
    confidence:   Math.round(confidence * 100) / 100,
  }));
}
