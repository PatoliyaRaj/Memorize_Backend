import { Request, Response } from 'express';
import { EdgeService } from '@/services/edgeService';
import { z } from 'zod';
import logger from '@/utils/logger';

const createEdgeSchema = z.object({
  source: z.string().uuid('Invalid source node ID'),
  target: z.string().uuid('Invalid target node ID'),
  edge_type: z.enum([
    'prerequisite_of',
    'leads_to',
    'related_to',
    'example_of',
    'exception_to',
    'part_of',
  ]).default('prerequisite_of'),
  label: z.string().optional(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
});

export class EdgeController {
  static async getEdgesByPlaylist(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { playlistId } = req.params;

      if (!playlistId) {
        res.status(400).json({ success: false, error: 'playlistId path param is required' });
        return;
      }

      const dbEdges = await EdgeService.getEdgesByPlaylist(userId, playlistId);
      
      // Map to frontend expectation
      const mapped = dbEdges.map((e) => ({
        id: e.id,
        source: e.sourceNodeId,
        target: e.targetNodeId,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        edge_type: e.edgeType,
        label: e.label,
      }));

      res.status(200).json(mapped);
    } catch (error: any) {
      logger.error('Failed to get edges by playlist', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async createEdge(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const parsed = createEdgeSchema.parse(req.body);

      const edge = await EdgeService.createEdge(userId, {
        sourceNodeId: parsed.source,
        targetNodeId: parsed.target,
        edgeType: parsed.edge_type,
        label: parsed.label,
        sourceHandle: parsed.sourceHandle,
        targetHandle: parsed.targetHandle,
      });

      const mapped = {
        id: edge.id,
        source: edge.sourceNodeId,
        target: edge.targetNodeId,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        edge_type: edge.edgeType,
        label: edge.label,
      };

      res.status(201).json(mapped);
      logger.info('Edge created', { edgeId: edge.id });
    } catch (error: any) {
      logger.error('Failed to create edge', { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async deleteEdge(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      await EdgeService.deleteEdge(userId, id);
      res.status(204).send();
      logger.info('Edge deleted', { edgeId: id });
    } catch (error: any) {
      logger.error('Failed to delete edge', { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }
}
