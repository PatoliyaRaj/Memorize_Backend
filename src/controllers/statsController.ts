import { Request, Response } from 'express';
import { StatsService } from '@/services/statsService';
import logger from '@/utils/logger';

export class StatsController {
  static async getRetentionData(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const data = await StatsService.getRetentionData(userId);
      res.status(200).json(data);
    } catch (error: any) {
      logger.error('Failed to compile retention curve stats', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getHeatmapData(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const data = await StatsService.getHeatmapData(userId);
      res.status(200).json(data);
    } catch (error: any) {
      logger.error('Failed to compile heatmap stats', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getWeakSpots(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const data = await StatsService.getWeakSpots(userId);
      res.status(200).json(data);
    } catch (error: any) {
      logger.error('Failed to compile weak spots leeches', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getSleepCorrelation(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const data = await StatsService.getSleepCorrelation(userId);
      res.status(200).json(data);
    } catch (error: any) {
      logger.error('Failed to compile sleep consolidation correlation metrics', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
