import crypto from 'crypto';

export interface ExtractionMetrics {
  method: string;
  detectedLang: string;
  confidence: number;
  totalTimeMs: number;
  extractionTimeMs: number;
  orchestrationTimeMs: number;
  fileSizeByte?: number;
  pageCount?: number;
  chunkCount?: number;
}

export function logExtractionMetrics(
  userId: string, 
  nodeId: string, 
  m: ExtractionMetrics,
  rawTextSample?: string
): void {
  // Anonymise raw content with SHA-256 for tracking without exposing PII
  const contentHash = rawTextSample
    ? crypto.createHash('sha256').update(rawTextSample).digest('hex')
    : undefined;

  const secureTelemetry = {
    timestamp: new Date().toISOString(),
    event: 'smart_import_completed',
    userId,
    nodeId,
    contentHash,
    method: m.method,
    detectedLang: m.detectedLang,
    confidence: m.confidence,
    totalTimeMs: m.totalTimeMs,
    extractionTimeMs: m.extractionTimeMs,
    orchestrationTimeMs: m.orchestrationTimeMs,
    fileSizeByte: m.fileSizeByte,
    pageCount: m.pageCount,
    chunkCount: m.chunkCount,
  };

  // Structured logging safe for Datadog / CloudWatch without carrying user text
  console.log(JSON.stringify(secureTelemetry));
}
