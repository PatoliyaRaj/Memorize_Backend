import { eq, sql } from 'drizzle-orm';
import { getDatabase } from '@/db';
import { nodes, type Node, type NewNode } from '@/db/schemas';

/**
 * Node Repository
 * Handles all database operations for the Node model using Drizzle ORM.
 *
 * NOTE: Nodes are scoped to a playlist — always filter by playlistId and userId
 * in higher-level service queries. This repo provides base CRUD only.
 */

export class NodeRepository {
  /**
   * Create a new node
   */
  static async create(data: NewNode): Promise<Node> {
    const db = await getDatabase();
    const result = await db.insert(nodes).values(data).returning();
    return result[0];
  }

  /**
   * Find node by ID
   */
  static async findById(id: string): Promise<Node | undefined> {
    const db = await getDatabase();
    const result = await db.select().from(nodes).where(eq(nodes.id, id));
    return result[0];
  }

  /**
   * Find all nodes in a playlist (lightweight — for canvas rendering)
   */
  static async findByPlaylist(playlistId: string): Promise<Node[]> {
    const db = await getDatabase();
    return await db
      .select()
      .from(nodes)
      .where(eq(nodes.playlistId, playlistId))
      .orderBy(nodes.orderIndex);
  }

  /**
   * Get all nodes (admin/debug only)
   */
  static async findAll(): Promise<Node[]> {
    const db = await getDatabase();
    return await db.select().from(nodes);
  }

  /**
   * Update node metadata or position
   */
  static async update(id: string, data: Partial<NewNode>): Promise<Node | undefined> {
    const db = await getDatabase();
    const result = await db
      .update(nodes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(nodes.id, id))
      .returning();
    return result[0];
  }

  /**
   * Delete node (cascades to nodeDetails, cards, cardStates, reviews)
   */
  static async delete(id: string): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.delete(nodes).where(eq(nodes.id, id));
    return !!result;
  }

  /**
   * Search nodes by title within a playlist
   */
  static async findByTitle(title: string, playlistId?: string): Promise<Node[]> {
    const db = await getDatabase();
    const query = db.select().from(nodes).where(eq(nodes.title, title));
    if (playlistId) {
      return await db
        .select()
        .from(nodes)
        .where(eq(nodes.playlistId, playlistId));
    }
    return await query;
  }

  /**
   * Count all nodes
   */
  static async count(): Promise<number> {
    const db = await getDatabase();
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(nodes);
    return result[0]?.count ?? 0;
  }
}
