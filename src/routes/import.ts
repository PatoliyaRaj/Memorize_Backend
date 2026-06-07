import { Router } from 'express';
import { fileUploadMiddleware } from '@/middlewares/upload';
import { handleSmartImport, handleConfirmImport } from '@/controllers/importController';
import { authMiddleware } from '@/middlewares/auth';

const router = Router();

// Step 1 — extract & analyse (NO DB writes)
router.post('/smart', authMiddleware, fileUploadMiddleware.single('file'), handleSmartImport);

// Step 2 — user confirmed (DB writes happen here)
router.post('/confirm', authMiddleware, handleConfirmImport);

export default router;
