import { Request, Response } from 'express';
import { StudyService } from '@/services/studyService';
import logger from '@/utils/logger';
import { z } from 'zod';

const postReviewSchema = z.object({
  cardId: z.string().uuid('Invalid card ID'),
  confidence: z.number().min(1).max(5),
  wasCorrect: z.boolean(),
  responseTimeMs: z.number().optional(),
});

export class StudyController {
  static async getCardsForNode(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { nodeId } = req.params;

      if (!nodeId) {
        res.status(400).json({ success: false, error: 'nodeId path param is required' });
        return;
      }

      const cards = await StudyService.getCardsForNode(userId, nodeId);
      res.status(200).json(cards);
    } catch (error: any) {
      logger.error('Failed to get cards for node', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async postReview(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const parsed = postReviewSchema.parse(req.body);

      const result = await StudyService.postReview(userId, parsed);
      res.status(200).json(result);
    } catch (error: any) {
      logger.error('Failed to submit card review', { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }
}
