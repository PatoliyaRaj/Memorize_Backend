/**
 * Smart Import Controller
 *
 * Security layers applied in this controller (after middleware):
 *  1. BOLA (Broken Object Level Authorization): Verify node ownership before any processing
 *  2. Server-side retry tracking: checkAndIncrementRetry() — immune to client body tampering
 *  3. File text sanitization: sanitizeInputForPrompt() applied to ALL inputs (file + paste)
 *  4. CWE-209: Error responses NEVER expose stack traces, file paths, or library names
 *  5. Atomic cleanup: temp files always deleted in finally block
 *
 * Two-step flow:
 *   handleSmartImport  — Step 1: Extract + analyse. NO database writes. Returns preview.
 *   handleConfirmImport — Step 2: User confirmed. Database writes with FSRS state.
 */

import { Request, Response }      from 'express';
import fs                          from 'fs';
import { performance }             from 'perf_hooks';
import { getDb }                   from '@/db';
import { nodes }                   from '@/db/schemas/nodes';
import { eq, and }                 from 'drizzle-orm';
import {
  processFileSecurely,
  processMultipleFiles,
  ExtractionPayload,
}                                  from '@/services/import/extractorService';
import { orchestrateLlmAnalysis }  from '@/services/import/orchestrator';
import { detectLanguageFromText }  from '@/services/import/languageDetector';
import { logExtractionMetrics }    from '@/services/import/telemetry';
import { saveImport }              from '@/services/import/saveService';
import {
  checkAndIncrementRetry,
  resetRetry,
}                                  from '@/utils/retryTracker';
import { z }                       from 'zod';

// ── Input Sanitization ─────────────────────────────────────────────────────

/**
 * Neutralize prompt injection attacks before text enters the LLM pipeline.
 * Applied to: pasted text, file-extracted text, nodeTitle, nodeType.
 *
 * Note: orchestrator.ts also applies escapeXmlEntities() as last line of defense.
 * Both layers together achieve defense-in-depth.
 */
function sanitizeInputForPrompt(input: string): string {
  if (!input) return '';
  return input
    .replace(/<\/?(system_instruction|user_content_data|user_content|SYSTEM|INST)>/gi, '[CLEANED_TAG]')
    .replace(/\[SYSTEM\]|\[\/SYSTEM\]|\[INST\]|\[\/INST\]/gi, '[CLEANED_TAG]')
    .replace(/(ignore|override|bypass)\s+(all\s+)?(previous\s+)?instructions/gi, '[INSTRUCTION_REDACTED]')
    .slice(0, 15_000); // Hard length cap prevents memory abuse
}

// ── Validation Schemas ─────────────────────────────────────────────────────

const ConfirmSchema = z.object({
  nodeId: z.string().uuid(),
  fields: z.object({
    theoryContent:    z.string().max(50_000).optional(),
    thingsToRemember: z.string().max(10_000).optional(),
    references:       z.array(z.object({
      title: z.string().max(200),
      url:   z.string().max(500),
      type:  z.string().max(50),
    })).max(20).optional(),
    emotionalAnchor:  z.string().max(500).optional(),
    isImportant:      z.boolean().optional(),
  }),
  cards: z.array(z.object({
    question:     z.string().min(5).max(300),
    answer:       z.string().min(3).max(600),   // Raised to 600 for structured markdown answers
    questionType: z.string().default('free_recall'),
    subTopic:     z.string().max(80).optional(),
    explanation:  z.string().max(1_000).optional(),
  })).max(25), // Hard cap — orchestrator limits to 20, but allow 25 for manual additions
});

// ── Step 1: Extract + Analyse ──────────────────────────────────────────────

export async function handleSmartImport(req: Request, res: Response) {
  const t0          = performance.now();
  const userId      = req.user!.id;
  const { nodeId, textContent, nodeTitle, nodeType, imageQuality } = req.body;

  // ── Input validation ────────────────────────────────────────────────────
  if (!nodeId || !z.string().uuid().safeParse(nodeId).success) {
    cleanupAllFiles(req);
    return res.status(400).json({ error: 'Valid node identifier is required.' });
  }

  // ── BOLA: Verify node ownership ─────────────────────────────────────────
  try {
    const db = getDb();
    const [node] = await db
      .select({ id: nodes.id })
      .from(nodes)
      .where(and(eq(nodes.id, nodeId), eq(nodes.userId, userId)))
      .limit(1);

    if (!node) {
      cleanupAllFiles(req);
      // Return 404 (not 403) — prevents UUID enumeration attacks
      return res.status(404).json({ error: 'Target resource not found.' });
    }
  } catch {
    cleanupAllFiles(req);
    return res.status(500).json({ error: 'Failed to process document content. Please try again.' });
  }

  // ── Server-side retry limit (DoW protection) ────────────────────────────
  if (!checkAndIncrementRetry(userId, nodeId)) {
    cleanupAllFiles(req);
    return res.status(429).json({
      error: 'Maximum retry limit reached for this node. Please wait 15 minutes before retrying.',
    });
  }

  // ── Input source check ──────────────────────────────────────────────────
  const singleFile  = (req as any).files?.['file']?.[0] as Express.Multer.File | undefined;
  const multiFiles  = (req as any).files?.['files'] as Express.Multer.File[] | undefined;
  const hasFile     = !!singleFile || !!(multiFiles?.length);
  const hasPaste    = !!(textContent?.trim());

  if (!hasFile && !hasPaste) {
    cleanupAllFiles(req);
    return res.status(400).json({ error: 'Provide a file or paste text content.' });
  }

  const allTempPaths: string[] = [
    ...(singleFile   ? [singleFile.path]                 : []),
    ...(multiFiles   ? multiFiles.map((f) => f.path)     : []),
  ];

  try {
    let extraction: ExtractionPayload;
    const extractStart = performance.now();

    if (multiFiles && multiFiles.length > 1) {
      // Multi-image path (up to 5 images concatenated with PAGE separators)
      extraction = await processMultipleFiles(
        multiFiles.map((f) => f.path),
        imageQuality || 'auto',
      );
    } else if (singleFile) {
      // Single file path (PDF, docx, txt, single image)
      extraction = await processFileSecurely(singleFile.path, imageQuality || 'auto');
    } else {
      // Pasted text path
      extraction = {
        text:         sanitizeInputForPrompt(textContent),
        detectedLang: detectLanguageFromText(textContent),
        method:       'paste',
        confidence:   1.0,
        pageCount:    1,
      };
    }

    const extractionTimeMs = performance.now() - extractStart;

    // Apply sanitization to file-extracted text too — not just pasted text
    // This closes the XML injection vector for PDF/docx/image extraction output
    const sanitizedText = sanitizeInputForPrompt(extraction.text);

    // ── structuredJson fast-path ─────────────────────────────────────────
    // If Vision API returned a pre-parsed JSON payload, skip the LLM orchestration
    // round-trip entirely (50% cost saving, ~50% latency reduction)
    if (extraction.structuredJson) {
      const { fields, cards } = extraction.structuredJson;

      logExtractionMetrics(userId, nodeId, {
        method:              extraction.method,
        detectedLang:        extraction.detectedLang,
        confidence:          extraction.confidence,
        totalTimeMs:         performance.now() - t0,
        extractionTimeMs,
        orchestrationTimeMs: 0,
        fileSizeByte:        singleFile?.size ?? 0,
        pageCount:           extraction.pageCount ?? 1,
        chunkCount:          0,
      }, extraction.text);

      resetRetry(userId, nodeId);
      return res.json({
        method:       extraction.method,
        detectedLang: extraction.detectedLang,
        confidence:   extraction.confidence,
        pageCount:    extraction.pageCount,
        fields,
        cards,
      });
    }

    // ── Standard LLM orchestration path ─────────────────────────────────
    const orchStart = performance.now();
    const result    = await orchestrateLlmAnalysis(
      sanitizedText,
      extraction.detectedLang,
      sanitizeInputForPrompt(nodeTitle || 'Concept'),
      sanitizeInputForPrompt(nodeType  || 'concept'),
    );
    const orchestrationTimeMs = performance.now() - orchStart;

    logExtractionMetrics(userId, nodeId, {
      method:              extraction.method,
      detectedLang:        extraction.detectedLang,
      confidence:          extraction.confidence,
      totalTimeMs:         performance.now() - t0,
      extractionTimeMs,
      orchestrationTimeMs,
      fileSizeByte:        singleFile?.size ?? 0,
      pageCount:           extraction.pageCount ?? 1,
      chunkCount:          result.metrics.chunkCount,
    }, sanitizedText);

    // Reset retry on success — allows re-import without waiting for window
    resetRetry(userId, nodeId);

    return res.json({
      method:       extraction.method,
      detectedLang: extraction.detectedLang,
      confidence:   extraction.confidence,
      pageCount:    extraction.pageCount,
      fields:       result.fields,
      cards:        result.cards,
    });

  } catch (err: any) {
    // CWE-209: Internal error details logged server-side ONLY
    // Client receives a generic message — no stack traces, file paths, or lib names
    console.error('[IMPORT PIPELINE ERROR]', { nodeId, userId, error: err?.message, stack: err?.stack });
    return res.status(500).json({ error: 'Failed to process document content. Please try again.' });

  } finally {
    // Always clean up temp files — even on error
    allTempPaths.forEach(cleanupFile);
  }
}

// ── Step 2: Confirm + Save ─────────────────────────────────────────────────

export async function handleConfirmImport(req: Request, res: Response) {
  try {
    const data   = ConfirmSchema.parse(req.body);
    const userId = req.user!.id;

    // BOLA: Double-check node ownership at save time
    // Defense-in-depth — user could have lost access between step 1 and step 2
    const db = getDb();
    const [node] = await db
      .select({ id: nodes.id })
      .from(nodes)
      .where(and(eq(nodes.id, data.nodeId), eq(nodes.userId, userId)))
      .limit(1);

    if (!node) {
      return res.status(404).json({ error: 'Target resource not found.' });
    }

    const result = await saveImport(data, userId);
    return res.json(result);

  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error:   'Invalid payload structure.',
        details: (err as z.ZodError).issues,
      });
    }
    // CWE-209: Generic 500 — no internal details exposed
    console.error('[IMPORT CONFIRM ERROR]', err);
    return res.status(500).json({ error: 'Failed to save import. Please try again.' });
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function cleanupFile(filePath: string | null | undefined): void {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.error(`[CLEANUP] Failed to delete temp file: ${filePath}`, e);
    }
  }
}

function cleanupAllFiles(req: Request): void {
  const single = (req as any).file;
  const multi  = (req as any).files;

  if (single?.path) cleanupFile(single.path);

  if (multi && typeof multi === 'object') {
    Object.values(multi).flat().forEach((f: any) => cleanupFile(f?.path));
  }
}
