import { Router } from 'express';
import { StatsController } from '@/controllers/statsController';
import { authMiddleware } from '@/middlewares/auth';

const router = Router();

// Secure all analytical routes with authentications
router.use(authMiddleware);

router.get('/retention', StatsController.getRetentionData);
router.get('/heatmap', StatsController.getHeatmapData);
router.get('/weak-spots', StatsController.getWeakSpots);
router.get('/sleep-correlation', StatsController.getSleepCorrelation);

export default router;
