import { Router } from 'express';
import { StudyController } from '@/controllers/studyController';
import { authMiddleware } from '@/middlewares/auth';

const router = Router();

// All study routes require authentication
router.use(authMiddleware);

router.get('/nodes/:nodeId/cards', StudyController.getCardsForNode);
router.post('/study/review', StudyController.postReview);

export default router;
