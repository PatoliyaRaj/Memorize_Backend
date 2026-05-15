import { eq, sql } from 'drizzle-orm';
import { getDatabase } from '@/db';
import { nodes, type Node, type NewNode } from '@/model/types';

/**
 * Node Repository
 * Handles all database operations for Node model using Drizzle ORM
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
    const result = await db.select().from(nodes).where(eq(nodes.Id, id));
    return result[0];
  }

  /**
   * Get all nodes
   */
  static async findAll(): Promise<Node[]> {
    const db = await getDatabase();
    return await db.select().from(nodes);
  }

  /**
   * Update node
   */
  static async update(id: string, data: Partial<NewNode>): Promise<Node | undefined> {
    const db = await getDatabase();
    const result = await db
      .update(nodes)
      .set({ ...data, updateTimestamp: new Date() })
      .where(eq(nodes.Id, id))
      .returning();
    return result[0];
  }

  /**
   * Delete node
   */
  static async delete(id: string): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.delete(nodes).where(eq(nodes.Id, id));
    return !!result;
  }

  /**
   * Search nodes by title
   */
  static async findByTitle(title: string): Promise<Node[]> {
    const db = await getDatabase();
    return await db
      .select()
      .from(nodes)
      .where(eq(nodes.title, title));
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
