import { Router } from 'express';
import { NotificationController } from '@/controllers/notificationController';
import { authMiddleware } from '@/middlewares/auth';

const router = Router();

// All notification routes require authentication
router.use(authMiddleware);

router.get('/notifications', NotificationController.getNotifications);
router.get('/notifications/stream', NotificationController.streamNotifications);
router.post('/notifications/subscribe', NotificationController.subscribePush);
router.patch('/notifications/:id/read', NotificationController.markAsRead);
router.post('/notifications/read-all', NotificationController.markAllAsRead);
router.post('/notifications/trigger-bedtime', NotificationController.triggerBedtime);

export default router;
