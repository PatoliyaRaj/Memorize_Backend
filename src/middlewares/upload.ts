import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

const uploadDir = '/tmp/neurolearn-uploads';

// Initialize directory with strict read/write/execute permissions restricted to owner (POSIX 0o700)
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true, mode: 0o700 });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    // Generate secure filename: cryptographically random UUID + base64-encoded sanitised client original name
    const secureId = randomUUID();
    const sanitizedOriginal = Buffer.from(file.originalname)
      .toString('base64url')
      .slice(0, 16);
    cb(null, `${secureId}-${sanitizedOriginal}${path.extname(file.originalname)}`);
  },
});

export const fileUploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // Strict 20MB limit
  },
});

export const uploadMiddleware = fileUploadMiddleware;
