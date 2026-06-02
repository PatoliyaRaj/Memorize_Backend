import { Router } from 'express';
import { SleepController } from '@/controllers/sleepController';
import { authMiddleware } from '@/middlewares/auth';

const router = Router();

// All sleep routes require authentication
router.use(authMiddleware);

router.post('/sleep', SleepController.logSleep);
router.get('/sleep', SleepController.getSleepLogs);
router.get('/sleep/window', SleepController.getCircadianStatus);
router.post('/sleep/onboarding', SleepController.completeOnboarding);

export default router;
