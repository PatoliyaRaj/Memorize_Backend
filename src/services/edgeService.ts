import { getDb } from '@/db';
import { edges, nodes } from '@/db/schemas';
import { eq, and } from 'drizzle-orm';

export type CreateEdgePayload = {
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: 'prerequisite_of' | 'leads_to' | 'related_to' | 'example_of' | 'exception_to' | 'part_of';
  label?: string;
  strength?: number;
  isCrossPlaylist?: boolean;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

export class EdgeService {
  static async getEdgesByPlaylist(userId: string, playlistId: string) {
    const db = getDb();
    
    // An edge is in a playlist if the source node is in that playlist
    // We join edges with nodes to check the playlistId
    const results = await db
      .select({
        id: edges.id,
        userId: edges.userId,
        sourceNodeId: edges.sourceNodeId,
        targetNodeId: edges.targetNodeId,
        sourceHandle: edges.sourceHandle,
        targetHandle: edges.targetHandle,
        edgeType: edges.edgeType,
        label: edges.label,
        strength: edges.strength,
        isCrossPlaylist: edges.isCrossPlaylist,
        createdAt: edges.createdAt,
      })
      .from(edges)
      .innerJoin(nodes, eq(edges.sourceNodeId, nodes.id))
      .where(and(eq(nodes.playlistId, playlistId), eq(edges.userId, userId)));
      
    return results;
  }

  static async createEdge(userId: string, data: CreateEdgePayload) {
    const db = getDb();
    const result = await db
      .insert(edges)
      .values({
        ...data,
        userId,
      })
      .returning();
      
    return result[0];
  }

  static async deleteEdge(userId: string, id: string) {
    const db = getDb();
    const result = await db
      .delete(edges)
      .where(and(eq(edges.id, id), eq(edges.userId, userId)))
      .returning();
      
    if (!result.length) throw new Error('Edge not found or unauthorized');
  }
}
