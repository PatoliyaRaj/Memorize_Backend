import multer from 'multer';

// Use memory storage to process the file as a buffer directly
const storage = multer.memoryStorage();

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, GIF, and PDF are allowed.'));
  }
};

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB max file size to prevent memory exhaustion
  },
  fileFilter,
});
