/**
 * Import Pipeline Telemetry v2.0
 *
 * PRIVACY: Only anonymized metrics are logged — never raw student notes.
 * The contentHash is a SHA-256 hash of the input text — useful for
 * detecting duplicate imports without storing the actual content.
 *
 * Security: Wrapped entirely in try-catch to ensure that any log blockage
 * or failure does not crash the active smart import request.
 */

import { createHash } from 'crypto';
import { SupportedLang } from './languageDetector';

export interface ImportMetrics {
  method:              string;
  detectedLang:        SupportedLang | 'auto';
  confidence:          number;
  totalTimeMs:         number;
  extractionTimeMs:    number;
  orchestrationTimeMs: number;
  fileSizeByte:        number;
  pageCount:           number;
  chunkCount:          number;
  
  // Card generation metrics
  cardsGenerated:      number;
  cardTypes:           Record<string, number>;
  deduplicationRate:   number;
  avgCardLength:       number;
  bloomDistribution:   Record<string, number>;
  
  // Detection metrics
  detectedSubject:     string;
  detectedAudience:    string;
  detectionSource:     'db' | 'content' | 'default' | 'caller';
  detectionConfidence: number;
  
  // Cost tracking
  inputTokens:         number;
  outputTokens:        number;
  estimatedCostUsd:    number;
  llmProvider:         string;
  llmModel:            string;
}

export interface ImportErrorMetrics {
  errorType:       'llm_timeout' | 'ocr_failure' | 'json_parse_error' | 'validation_error' | 'unknown';
  errorMessage:    string;
  failedAtStage:   'extraction' | 'orchestration' | 'validation' | 'save';
  totalTimeMs:     number;
}

// Success metrics logging with strict try-catch isolation
export function logExtractionMetrics(
  userId:   string,
  nodeId:   string,
  metrics:  ImportMetrics,
  rawText?: string,
): void {
  try {
    const contentHash = rawText
      ? createHash('sha256').update(rawText).digest('hex').slice(0, 16)
      : 'text-not-provided';

    const event = {
      timestamp:           new Date().toISOString(),
      event:               'smart_import_completed',
      userId,
      nodeId,
      contentHash,
      method:              metrics.method,
      detectedLang:        metrics.detectedLang,
      confidence:          Math.round(metrics.confidence * 100) / 100,
      totalTimeMs:         Math.round(metrics.totalTimeMs),
      extractionTimeMs:    Math.round(metrics.extractionTimeMs),
      orchestrationTimeMs: Math.round(metrics.orchestrationTimeMs),
      fileSizeByte:        metrics.fileSizeByte,
      pageCount:           metrics.pageCount,
      chunkCount:          metrics.chunkCount,
      
      // Card metrics
      cardsGenerated:      metrics.cardsGenerated,
      cardTypes:           metrics.cardTypes,
      deduplicationRate:   Math.round(metrics.deduplicationRate * 100) / 100,
      avgCardLength:       Math.round(metrics.avgCardLength),
      bloomDistribution:   metrics.bloomDistribution,
      
      // Detection metrics
      detectedSubject:     metrics.detectedSubject,
      detectedAudience:    metrics.detectedAudience,
      detectionSource:     metrics.detectionSource,
      detectionConfidence: Math.round(metrics.detectionConfidence * 100) / 100,
      
      // Cost metrics
      inputTokens:         metrics.inputTokens,
      outputTokens:        metrics.outputTokens,
      estimatedCostUsd:    Math.round(metrics.estimatedCostUsd * 10000) / 10000,
      llmProvider:         metrics.llmProvider,
      llmModel:            metrics.llmModel,
    };

    console.log(JSON.stringify(event));
  } catch (err) {
    console.error('[TELEMETRY EXCEPTION] Failed to log success metrics safely:', err);
  }
}

// Error path logging with strict try-catch isolation
export function logExtractionError(
  userId:   string,
  nodeId:   string,
  metrics:  ImportErrorMetrics,
  rawText?: string,
): void {
  try {
    const contentHash = rawText
      ? createHash('sha256').update(rawText).digest('hex').slice(0, 16)
      : 'text-not-provided';

    const event = {
      timestamp:       new Date().toISOString(),
      event:           'smart_import_failed',
      userId,
      nodeId,
      contentHash,
      errorType:       metrics.errorType,
      errorMessage:    metrics.errorMessage.slice(0, 200), // Truncate verbose stack traces
      failedAtStage:   metrics.failedAtStage,
      totalTimeMs:     Math.round(metrics.totalTimeMs),
    };

    console.error(JSON.stringify(event));
  } catch (err) {
    console.error('[TELEMETRY EXCEPTION] Failed to log error metrics safely:', err);
  }
}
