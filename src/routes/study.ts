import { Router } from 'express';
import { StudyController } from '@/controllers/studyController';
import { authMiddleware } from '@/middlewares/auth';

const router = Router();

// All study routes require authentication
router.use(authMiddleware);

router.get('/nodes/:nodeId/cards', StudyController.getCardsForNode);
router.get('/study/due-cards', StudyController.getDueCards);
router.post('/nodes/:nodeId/cards', StudyController.createCard);
router.post('/study/review', StudyController.postReview);
router.post('/study/session', StudyController.startSession);
router.patch('/study/session/:sessionId/end', StudyController.endSession);
router.patch('/cards/:cardId', StudyController.updateCard);
router.delete('/cards/:cardId', StudyController.deleteCard);

export default router;
