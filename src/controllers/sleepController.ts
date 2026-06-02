import { Request, Response } from 'express';
import { SleepService } from '@/services/sleepService';
import { z } from 'zod';
import logger from '@/utils/logger';

const logSleepSchema = z.object({
  sleepDate: z.string(),
  sleepTime: z.string(),
  wakeTime: z.string(),
  quality: z.number().int().min(1).max(5),
  notes: z.string().optional(),
});

export class SleepController {
  static async logSleep(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const data = logSleepSchema.parse(req.body);

      const log = await SleepService.logSleep(userId, data);
      logger.info('Sleep logged successfully', { userId, sleepDate: data.sleepDate });
      res.status(201).json({ success: true, data: log });
    } catch (error: any) {
      logger.error('Failed to log sleep', { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async getSleepLogs(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const logs = await SleepService.getSleepLogs(userId);
      logger.info('Sleep logs fetched', { userId, logsCount: logs.length });
      res.status(200).json({ success: true, data: logs });
    } catch (error: any) {
      logger.error('Failed to fetch sleep logs', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getCircadianStatus(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const status = await SleepService.isGoodStudyTime(userId);
      res.status(200).json({ success: true, data: status });
    } catch (error: any) {
      logger.error('Failed to check circadian study window', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async completeOnboarding(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const payload = req.body;
      const profile = await SleepService.completeOnboarding(userId, payload);
      logger.info('User completed onboarding successfully', { userId });
      res.status(200).json({ success: true, data: profile });
    } catch (error: any) {
      logger.error('Failed to complete user onboarding', { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }
}
