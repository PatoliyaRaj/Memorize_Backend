import { Request, Response } from 'express';
import fs from 'fs';
import { performance } from 'perf_hooks';
import { getDb } from '@/db';
import { nodes } from '@/db/schemas/nodes';
import { eq, and } from 'drizzle-orm';
import { processFileSecurely } from '@/services/import/extractorService';
import { orchestrateLlmAnalysis } from '@/services/import/orchestrator';
import { detectLanguageFromText } from '@/services/import/languageDetector';
import { logExtractionMetrics } from '@/services/import/telemetry';
import { saveImport } from '@/services/import/saveService';
import { z } from 'zod';

export async function handleSmartImport(req: Request, res: Response) {
  const t0 = performance.now();
  const file = req.file;
  const { nodeId, textContent, nodeTitle, nodeType, imageQuality } = req.body;

  if (!nodeId || !z.string().uuid().safeParse(nodeId).success) {
    cleanupUploadedFile(file?.path);
    return res.status(400).json({ error: 'Valid node identifier is required.' });
  }

  // --- CRITICAL BOLA PROTECTION ---
  // Verify that the authenticated user actually owns the node before doing any extraction
  try {
    const db = getDb();
    const existingNode = await db
      .select({ id: nodes.id })
      .from(nodes)
      .where(and(eq(nodes.id, nodeId), eq(nodes.userId, req.user!.id)))
      .limit(1);

    if (existingNode.length === 0) {
      cleanupUploadedFile(file?.path);
      // Return 404 (Not Found) instead of 403 (Forbidden) to prevent UUID scanning / enumeration
      return res.status(404).json({ error: 'Target resource not found.' });
    }
  } catch (dbError) {
    cleanupUploadedFile(file?.path);
    return res.status(500).json({ error: 'Verification failed.' });
  }

  if (!file && !textContent?.trim()) {
    return res.status(400).json({ error: 'Provide a file or text content.' });
  }

  const tempPath = file?.path ?? null;

  try {
    let rawText = '', method = 'paste', confidence = 1.0;
    const extractStart = performance.now();

    if (tempPath) {
      const extraction = await processFileSecurely(tempPath, imageQuality);
      rawText = extraction.text;
      method = extraction.method;
      confidence = extraction.confidence;
    } else {
      // SANITIZATION FOR RAW TEXT
      rawText = sanitizeInputForPrompt(textContent);
    }

    const detectedLang = detectLanguageFromText(rawText);
    const extractTime = performance.now() - extractStart;

    const orchStart = performance.now();
    const result = await orchestrateLlmAnalysis(
      rawText,
      detectedLang,
      sanitizeInputForPrompt(nodeTitle || 'Concept'),
      sanitizeInputForPrompt(nodeType || 'concept')
    );
    const orchTime = performance.now() - orchStart;

    logExtractionMetrics(req.user!.id, nodeId, {
      method,
      detectedLang,
      confidence,
      totalTimeMs: performance.now() - t0,
      extractionTimeMs: extractTime,
      orchestrationTimeMs: orchTime,
      fileSizeByte: file?.size,
      chunkCount: result.metrics.chunkCount,
    }, rawText);

    return res.json({
      method,
      detectedLang,
      confidence,
      fields: result.fields,
      cards: result.cards,
    });

  } catch (err: any) {
    console.error('[IMPORT PIPELINE ERROR] Fatal:', err);
    return res.status(500).json({ error: 'Failed to process document content securely.', details: err.message });
  } finally {
    cleanupUploadedFile(tempPath);
  }
}

// BOLA validation for confirmation and save operations
export async function handleConfirmImport(req: Request, res: Response) {
  const ConfirmSchema = z.object({
    nodeId: z.string().uuid(),
    fields: z.object({
      theoryContent:    z.string().optional(),
      thingsToRemember: z.string().optional(),
      references:       z.array(z.object({ title: z.string(), url: z.string(), type: z.string() })).optional(),
      emotionalAnchor:  z.string().optional(),
      isImportant:      z.boolean().optional(),
    }),
    cards: z.array(z.object({
      question:     z.string().min(5).max(300),
      answer:       z.string().min(3).max(500),
      questionType: z.string().default('free_recall'),
      subTopic:     z.string().max(50).optional(),
      explanation:  z.string().max(500).optional(),
    })),
  });

  try {
    const data = ConfirmSchema.parse(req.body);

    // Strict ownership validation check
    const db = getDb();
    const existingNode = await db
      .select({ id: nodes.id })
      .from(nodes)
      .where(and(eq(nodes.id, data.nodeId), eq(nodes.userId, req.user!.id)))
      .limit(1);

    if (existingNode.length === 0) {
      return res.status(404).json({ error: 'Target resource not found.' });
    }

    const result = await saveImport(data, req.user!.id);
    return res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid payload structure.', details: (err as any).errors });
    }
    console.error('[IMPORT CONFIRM ERROR] Fatal:', err);
    return res.status(500).json({ error: 'Save failed.' });
  }
}

function cleanupUploadedFile(filePath: string | null | undefined): void {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.error(`Failed to delete temp file: ${filePath}`, e);
    }
  }
}

// Input Sanitizer to neutralize prompt injection blocks
function sanitizeInputForPrompt(input: string): string {
  if (!input) return '';
  return input
    .replace(/<\/?(system_instruction|user_content|user_content_start|user_content_end|user_content_data)>/gi, '[CLEANED_TAG]')
    .replace(/(ignore|override|bypass)\s+(all\s+)?(previous\s+)?instructions/gi, '[INSTRUCTION_REDACTED]')
    .slice(0, 15000); // Strict length boundary to prevent memory abuse
}
