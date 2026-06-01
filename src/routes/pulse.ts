import { Router } from 'express';
import { PulseController } from '@/controllers/pulseController';
import { authMiddleware } from '@/middlewares/auth';

const router = Router();

// Secure all endpoints with JWT auth middleware
router.use(authMiddleware);

router.get('/pulse', PulseController.getTodayQueue);
router.post('/pulse/regenerate', PulseController.forceRegenerateQueue);

export default router;
