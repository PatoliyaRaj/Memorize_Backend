/**
 * Smart Import Routes
 *
 * Security layers (applied in order):
 *   Layer 1: IP-based rate limit — 30 req/hour per IP, NO auth needed
 *             → Prevents unauthenticated flooding before auth DB query
 *   Layer 2: Auth middleware — validates JWT
 *   Layer 3: User rate limit — 10 req/15min per userId (after auth)
 *   Layer 4: multiUpload — validates file type + size at Multer layer
 *   Layer 5: Handler — BOLA + server-side retry + sanitization
 *
 * Routes:
 *   POST /api/import/smart   — Step 1: extract + analyse (no DB writes)
 *   POST /api/import/confirm — Step 2: user confirmed (DB writes)
 *   GET  /api/import/health  — Pipeline health check
 */

import { Router }      from 'express';
import rateLimit       from 'express-rate-limit';
import fs              from 'fs';
import { multiUpload } from '@/middlewares/upload';
import { handleSmartImport, handleConfirmImport } from '@/controllers/importController';
import { authMiddleware } from '@/middlewares/auth';

const router = Router();

// ── Rate Limiters ──────────────────────────────────────────────────────────

/**
 * Layer 1: IP-based rate limiter — runs BEFORE auth.
 * Prevents unauthenticated brute-force flooding at the network layer.
 * No DB query needed — keyed purely by IP.
 */
const ipImportLimiter = rateLimit({
  windowMs:       60 * 60 * 1000, // 1 hour
  max:            30,              // 30 requests per IP per hour
  standardHeaders: true,
  legacyHeaders:  false,
  handler:        (_req, res) => {
    res.status(429).json({
      error: 'Network rate limit reached. Please wait before importing again.',
    });
  },
});

/**
 * Layer 3: User-level rate limiter — runs AFTER auth (userId available).
 * Stricter limit tied to authenticated identity, not just IP.
 * Keyed by userId when authenticated.
 */
const userImportLimiter = rateLimit({
  windowMs:       15 * 60 * 1000, // 15 minutes
  max:            10,              // 10 imports per user per 15 minutes
  standardHeaders: true,
  legacyHeaders:  false,
  keyGenerator:   (req: any) => req.user?.id ?? 'unknown',
  handler:        (_req, res) => {
    res.status(429).json({
      error: 'Too many import requests. Please wait 15 minutes before importing again.',
    });
  },
});

// ── Routes ─────────────────────────────────────────────────────────────────

/**
 * POST /api/import/smart
 * Step 1: Extract text from file/text, run LLM analysis, return preview.
 * No database writes. User reviews and edits before confirming.
 */
router.post(
  '/smart',
  ipImportLimiter,   // Layer 1: IP gate (no auth cost)
  authMiddleware,    // Layer 2: Auth
  userImportLimiter, // Layer 3: User gate
  multiUpload,       // Layer 4: File validation (type + size)
  handleSmartImport, // Layer 5: Business logic
);

/**
 * POST /api/import/confirm
 * Step 2: Save confirmed cards to database with FSRS initialization.
 * DB writes happen here — protected by BOLA + retry tracker + row lock.
 */
router.post(
  '/confirm',
  ipImportLimiter,
  authMiddleware,
  userImportLimiter,
  handleConfirmImport,
);

/**
 * GET /api/import/health
 * Pipeline health check — returns component status without revealing internals.
 * No auth required — useful for monitoring systems and staging verification.
 */
router.get('/health', (_req, res) => {
  const uploadDir = '/tmp/neurolearn-uploads';
  let tempDirWritable = false;

  try {
    fs.accessSync(uploadDir, fs.constants.W_OK);
    tempDirWritable = true;
  } catch {
    tempDirWritable = false;
  }

  const checks = {
    nvidiaVisionKeyConfigured: !!process.env.NVIDIA_NIM_API_KEY,
    visionModel:               process.env.NIM_VISION_MODEL ?? 'meta/llama-4-maverick-17b-128e-instruct',
    textModel:                 process.env.NIM_TEXT_MODEL   ?? 'meta/llama-3.1-8b-instruct',
    tempDirectoryWritable:     tempDirWritable,
    tempDirectoryPath:         uploadDir,
  };

  const isHealthy = checks.nvidiaVisionKeyConfigured && checks.tempDirectoryWritable;
  return res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    ...checks,
  });
});

export default router;
