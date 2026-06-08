/**
 * Multer Secure Upload Middleware
 *
 * Security properties:
 *  - DiskStorage (not MemoryStorage) → prevents V8 RAM spikes under concurrent uploads
 *  - crypto.randomUUID() filenames → prevents path traversal via filename injection
 *  - mode: 0o700 → temp directory is owner-only (prevents other OS processes from reading uploads)
 *  - 20MB limit per file — enforced at Multer layer before any processing
 *  - fileFilter → rejects unsupported MIME types immediately (before file hits disk)
 *  - singleUpload: single file (PDF/docx/txt/md) — legacy compatibility
 *  - multiUpload: supports both 'file' field (1 doc) AND 'files' field (up to 5 images)
 */

import multer from 'multer';
import path   from 'path';
import fs     from 'fs';
import { randomUUID } from 'crypto';
import type { RequestHandler } from 'express'; 

const UPLOAD_DIR = '/tmp/neurolearn-uploads';

// Ensure directory exists with restrictive permissions (owner read/write/execute only)
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true, mode: 0o700 });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file,  cb) => {
    const secureId       = randomUUID();
    // Base64url-encode original name (strips slashes/dots/special chars) as harmless label
    const sanitizedLabel = Buffer.from(file.originalname)
      .toString('base64url')
      .slice(0, 12);
    const ext            = path.extname(file.originalname).toLowerCase();
    cb(null, `${secureId}-${sanitizedLabel}${ext}`);
  },
});

/** Allowlist of accepted MIME types — everything else is rejected */
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
]);

/**
 * File filter — rejects unsupported types at the Multer layer,
 * before the file is written to disk or reaches the handler.
 */
const FILE_FILTER: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type "${file.mimetype}" is not supported. Allowed: PDF, JPG, PNG, WEBP, DOCX, TXT, MD`));
  }
};

export const fileUploadMiddleware = multer({
  storage,
  limits:     { fileSize: 20 * 1024 * 1024 }, // 20 MB hard cap
  fileFilter: FILE_FILTER,
});

// ── Exports ────────────────────────────────────────────────────────────────

/** Legacy single-file upload (PDF, docx, txt) — backward compatible */
export const uploadMiddleware = fileUploadMiddleware;

/** Single file: 'file' field — used by single-file import flows */
export const singleUpload: RequestHandler= fileUploadMiddleware.single('file');

/**
 * Multi-file upload:
 *   - 'file'  field → up to 1 document (PDF / docx / txt)
 *   - 'files' field → up to 5 image files (JPG/PNG/WEBP for multi-page notes)
 */
export const multiUpload: RequestHandler = fileUploadMiddleware.fields([
  { name: 'file',  maxCount: 1 },
  { name: 'files', maxCount: 5 },
]);
