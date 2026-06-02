import { Request, Response } from 'express';
import { StudyService } from '@/services/studyService';
import logger from '@/utils/logger';
import { z } from 'zod';

const postReviewSchema = z.object({
  cardId: z.string().uuid('Invalid card ID'),
  confidence: z.number().min(1).max(5),
  wasCorrect: z.boolean(),
  responseTimeMs: z.number().optional(),
  sessionId: z.string().uuid('Invalid session ID').optional(),
  reviewType: z.enum(['normal', 'remedial', 'prereq', 'interleaved', 'feynman']).optional(),
});

const startSessionSchema = z.object({
  basketId: z.string().uuid('Invalid basket ID').optional(),
  mode: z.enum(['normal', 'interleaved', 'exam', 'remedial', 'prereq']).optional(),
  notes: z.string().optional(),
});

const endSessionSchema = z.object({
  notes: z.string().optional(),
});

const createCardSchema = z.object({
  question: z.string().min(1, 'Question is required'),
  answer: z.string().min(1, 'Answer is required'),
  explanation: z.string().optional(),
  questionType: z.enum(['free_recall', 'cloze', 'ordering', 'matching', 'multiple_choice']).optional(),
  orderIndex: z.number().int().optional(),
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

  static async getDueCards(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const basketId = req.query.basketId as string | undefined;

      const dueCards = await StudyService.getDueCards(userId, basketId);
      res.status(200).json(dueCards);
    } catch (error: any) {
      logger.error('Failed to get due cards', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async updateCard(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { cardId } = req.params;
      const payload = req.body;
      const updated = await StudyService.updateCard(userId, cardId, payload);
      res.status(200).json(updated);
    } catch (error: any) {
      logger.error('Failed to update card', { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async createCard(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { nodeId } = req.params;
      const parsed = createCardSchema.parse(req.body);

      if (!nodeId) {
        res.status(400).json({ success: false, error: 'nodeId path param is required' });
        return;
      }

      const created = await StudyService.createCard(userId, nodeId, parsed);
      res.status(201).json(created);
    } catch (error: any) {
      logger.error('Failed to create card', { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async deleteCard(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { cardId } = req.params;
      const result = await StudyService.deleteCard(userId, cardId);
      res.status(200).json(result);
    } catch (error: any) {
      logger.error('Failed to delete card', { error: error.message });
      res.status(400).json({ success: false, error: error.message });
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

  static async startSession(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const parsed = startSessionSchema.parse(req.body);
      const session = await StudyService.startStudySession(userId, parsed);
      res.status(201).json(session);
    } catch (error: any) {
      logger.error('Failed to start study session', { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async endSession(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { sessionId } = req.params;
      const parsed = endSessionSchema.parse(req.body);

      if (!sessionId) {
        res.status(400).json({ success: false, error: 'sessionId parameter is required' });
        return;
      }

      const session = await StudyService.endStudySession(userId, sessionId, parsed);
      res.status(200).json(session);
    } catch (error: any) {
      logger.error('Failed to end study session', { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }
}
