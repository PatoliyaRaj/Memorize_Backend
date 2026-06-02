import { Request, Response } from 'express';
import { NotificationService } from '@/services/notificationService';
import logger from '@/utils/logger';

export class NotificationController {
  static async getNotifications(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const list = await NotificationService.getNotifications(userId);
      res.status(200).json({ success: true, data: list });
    } catch (error: any) {
      logger.error('Failed to get notifications', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async markAsRead(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const updated = await NotificationService.markAsRead(userId, id);
      if (!updated) {
        res.status(404).json({ success: false, error: 'Notification not found' });
        return;
      }
      res.status(200).json({ success: true, data: updated });
    } catch (error: any) {
      logger.error('Failed to mark notification as read', { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async markAllAsRead(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const updated = await NotificationService.markAllAsRead(userId);
      res.status(200).json({ success: true, data: { count: updated.length } });
    } catch (error: any) {
      logger.error('Failed to mark all notifications as read', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async triggerBedtime(_req: Request, res: Response) {
    try {
      const alerts = await NotificationService.triggerSmartBedtimeNotifications();
      logger.info('Zoned bedtime notification check triggered', { alertsCreated: alerts.length });
      res.status(200).json({ success: true, data: { alertsCreated: alerts.length, alerts } });
    } catch (error: any) {
      logger.error('Failed to trigger bedtime check', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async streamNotifications(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      NotificationService.addClient(userId, res);
      res.write('data: {"connected":true}\n\n');
      logger.info('User SSE stream client connected', { userId });
    } catch (error: any) {
      logger.error('SSE client initialization failed', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async subscribePush(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { subscription } = req.body;
      
      if (!subscription || !subscription.endpoint || !subscription.keys) {
        res.status(400).json({ success: false, error: 'Malformed push subscription payload' });
        return;
      }

      const saved = await NotificationService.subscribePush(userId, subscription);
      res.status(200).json({ success: true, data: saved });
    } catch (error: any) {
      logger.error('Failed to subscribe push alerts', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
