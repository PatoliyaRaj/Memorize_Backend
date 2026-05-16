import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDatabase } from '@/db';
import { users, type User, type NewUser } from '@/db/schemas';

/**
 * User Repository
 * Handles all database operations for User model using Drizzle ORM
 */

export class UserRepository {
  private static readonly uuidSchema = z.string().uuid();

  private static isUuid(id: string): boolean {
    return this.uuidSchema.safeParse(id).success;
  }

  /**
   * Create a new user
   */
  static async create(data: NewUser): Promise<User> {
    const db = await getDatabase();
    const result = await db.insert(users).values(data).returning();
    return result[0];
  }

  /**
   * Find user by ID
   */
  static async findById(id: string): Promise<User | undefined> {
    if (!this.isUuid(id)) {
      return undefined;
    }

    const db = await getDatabase();
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  /**
   * Find user by email
   */
  static async findByEmail(email: string): Promise<User | undefined> {
    const db = await getDatabase();
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  /**
   * Get all users
   */
  static async findAll(): Promise<User[]> {
    const db = await getDatabase();
    return await db.select().from(users);
  }

  /**
   * Update user
   */
  static async update(id: string, data: Partial<NewUser>): Promise<User | undefined> {
    if (!this.isUuid(id)) {
      return undefined;
    }

    const db = await getDatabase();
    const result = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  /**
   * Delete user
   */
  static async delete(id: string): Promise<boolean> {
    if (!this.isUuid(id)) {
      return false;
    }

    const db = await getDatabase();
    const result = await db.delete(users).where(eq(users.id, id));
    return !!result;
  }

  /**
   * Count all users
   */
  static async count(): Promise<number> {
    const db = await getDatabase();
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    return result[0]?.count ?? 0;
  }
}
