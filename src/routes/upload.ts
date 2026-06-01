import { Router } from 'express';
import { authMiddleware } from '@/middlewares/auth';
import { uploadMiddleware } from '@/middlewares/upload';
import { ImageUploadController } from '@/controllers/imageuploadController';

const router = Router();

// Upload a file (requires auth, expects a field named 'file' in form-data)
router.post('/', authMiddleware, uploadMiddleware.single('file') as any, ImageUploadController.uploadImage);

export default router;
