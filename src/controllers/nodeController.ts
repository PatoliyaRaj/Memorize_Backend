import { Request, Response } from 'express';
import { NodeService } from '@/services/nodeService';
import { createNodeSchema, updateNodeSchema, updateNodeDetailsSchema } from '@/validators/curriculum';
import logger from '@/utils/logger';
import { getDb } from '@/db';
import { cards, cardStates } from '@/db/schemas';
import { eq, and, or, isNull, lte, sql } from 'drizzle-orm';

export class NodeController {
  static async createNode(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const data = createNodeSchema.parse(req.body);
      
      const node = await NodeService.createNode(userId, data);
      res.status(201).json({ success: true, data: node });
      logger.info("Node created", { nodeId: node.id });
    } catch (error: any) {
      logger.error("Failed to create node", { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async getNodes(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { playlistId } = req.query;
      
      if (!playlistId) {
        res.status(400).json({ success: false, error: 'playlistId query param is required' });
        return;
      }

      const nodes = await NodeService.getNodesByPlaylist(userId, playlistId as string);
      res.status(200).json({ success: true, data: nodes });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getNodeById(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const node = await NodeService.getNodeById(userId, id);
      res.status(200).json({ success: true, data: node });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message });
    }
  }

  static async updateNode(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const data = updateNodeSchema.parse(req.body);
      const node = await NodeService.updateNode(userId, id, data);
      res.status(200).json({ success: true, data: node });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async deleteNode(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      await NodeService.deleteNode(userId, id);
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  // --- Node Details Controllers ---

  static async getNodeDetails(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params; // Node ID
      const details = await NodeService.getNodeDetails(userId, id);
      
      // Calculate due cards count
      const db = getDb();
      const now = new Date();
      const dueCountResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(cards)
        .leftJoin(cardStates, eq(cards.id, cardStates.cardId))
        .where(
          and(
            eq(cards.nodeId, id),
            eq(cards.userId, userId),
            or(
              isNull(cardStates.nextReview),
              lte(cardStates.nextReview, now)
            )
          )
        );
      
      const cards_due_count = dueCountResult[0]?.count ?? 0;

      const mapped = {
        id: details.nodeId,
        nodeId: details.nodeId,
        theory: details.theoryContent || '',
        takeaways: details.thingsToRemember ? details.thingsToRemember.split('\n').filter(Boolean) : [],
        emotional_anchor: details.emotionalAnchor || '',
        references: details.references || [],
        images: details.images || [],
        files: details.files || [],
        isImportant: details.isImportant,
        examRelevance: details.examRelevance,
        cards_due_count,
      };

      res.status(200).json({ success: true, data: mapped });
    } catch (error: any) {
      logger.error('Failed to get node details', { error: error.message });
      res.status(404).json({ success: false, error: error.message });
    }
  }

  static async updateNodeDetails(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params; // Node ID
      const parsed = updateNodeDetailsSchema.parse(req.body);
      
      const updateData: any = {};
      
      if (parsed.theoryContent !== undefined) updateData.theoryContent = parsed.theoryContent;
      if (parsed.theory !== undefined) updateData.theoryContent = parsed.theory;
      
      if (parsed.thingsToRemember !== undefined) updateData.thingsToRemember = parsed.thingsToRemember;
      if (parsed.takeaways !== undefined) updateData.thingsToRemember = parsed.takeaways.join('\n');
      
      if (parsed.emotionalAnchor !== undefined) updateData.emotionalAnchor = parsed.emotionalAnchor;
      if (parsed.emotional_anchor !== undefined) updateData.emotionalAnchor = parsed.emotional_anchor;
      
      if (parsed.references !== undefined) updateData.references = parsed.references;
      if (parsed.images !== undefined) updateData.images = parsed.images;
      if (parsed.files !== undefined) updateData.files = parsed.files;
      if (parsed.isImportant !== undefined) updateData.isImportant = parsed.isImportant;
      if (parsed.examRelevance !== undefined) updateData.examRelevance = parsed.examRelevance;

      const details = await NodeService.updateNodeDetails(userId, id, updateData);
      
      const mapped = {
        id: details.nodeId,
        nodeId: details.nodeId,
        theory: details.theoryContent || '',
        takeaways: details.thingsToRemember ? details.thingsToRemember.split('\n').filter(Boolean) : [],
        emotional_anchor: details.emotionalAnchor || '',
        references: details.references || [],
        images: details.images || [],
        files: details.files || [],
        isImportant: details.isImportant,
        examRelevance: details.examRelevance,
      };

      res.status(200).json({ success: true, data: mapped });
    } catch (error: any) {
      logger.error('Failed to update node details', { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }

}
