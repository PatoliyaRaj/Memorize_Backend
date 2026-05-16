import { type Node, type NewNode, type NodeDetail } from '@/model/types';
import { getDb } from '@/db';
import { nodes, nodeDetails } from '@/db/schemas';
import { eq, and } from 'drizzle-orm';

export class NodeService {
  static async createNode(userId: string, data: Omit<NewNode, 'userId' | 'id'>): Promise<Node> {
    const db = getDb();
    
    // Use transaction to ensure both node and empty node details are created
    return await db.transaction(async (tx) => {
      const result = await tx.insert(nodes).values({
        ...data,
        userId,
      }).returning();
      
      const newNode = result[0];
      
      // Automatically create empty node details for lazy-loading later
      await tx.insert(nodeDetails).values({
        nodeId: newNode.id,
      });
      
      return newNode;
    });
  }

  static async getNodesByPlaylist(userId: string, playlistId: string): Promise<Node[]> {
    const db = getDb();
    return db.select().from(nodes).where(
      and(eq(nodes.playlistId, playlistId), eq(nodes.userId, userId))
    );
  }

  static async getNodeById(userId: string, id: string): Promise<Node> {
    const db = getDb();
    const result = await db.select().from(nodes).where(and(eq(nodes.id, id), eq(nodes.userId, userId)));
    if (!result.length) throw new Error('Node not found or unauthorized');
    return result[0];
  }

  static async updateNode(userId: string, id: string, data: Partial<Node>): Promise<Node> {
    const db = getDb();
    const result = await db.update(nodes)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(nodes.id, id), eq(nodes.userId, userId)))
      .returning();
    if (!result.length) throw new Error('Node not found or unauthorized');
    return result[0];
  }

  static async deleteNode(userId: string, id: string): Promise<void> {
    const db = getDb();
    const result = await db.delete(nodes)
      .where(and(eq(nodes.id, id), eq(nodes.userId, userId)))
      .returning();
    if (!result.length) throw new Error('Node not found or unauthorized');
  }

  // --- Node Details (Lazy Loaded) ---
  
  static async getNodeDetails(userId: string, nodeId: string): Promise<NodeDetail> {
    const db = getDb();
    // First verify user owns the node
    await this.getNodeById(userId, nodeId);
    
    const result = await db.select().from(nodeDetails).where(eq(nodeDetails.nodeId, nodeId));
    if (!result.length) throw new Error('Node details not found');
    return result[0];
  }

  static async updateNodeDetails(userId: string, nodeId: string, data: Partial<NodeDetail>): Promise<NodeDetail> {
    const db = getDb();
    // Verify ownership
    await this.getNodeById(userId, nodeId);
    
    const result = await db.update(nodeDetails)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(nodeDetails.nodeId, nodeId))
      .returning();
      
    if (!result.length) throw new Error('Node details not found');
    return result[0];
  }
}
