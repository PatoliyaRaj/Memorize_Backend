import { type Basket, type NewBasket } from '@/model/types';
import { getDb } from '@/db';
import { baskets } from '@/db/schemas';
import { eq, and } from 'drizzle-orm';

export class BasketService {
  static async createBasket(userId: string, data: Omit<NewBasket, 'userId' | 'id'>): Promise<Basket> {
    const db = getDb();
    const result = await db.insert(baskets).values({
      ...data,
      userId,
    }).returning();
    return result[0];
  }

  static async getBasketsByUser(userId: string): Promise<Basket[]> {
    const db = getDb();
    return db.select().from(baskets).where(eq(baskets.userId, userId));
  }

  static async getBasketById(userId: string, id: string): Promise<Basket> {
    const db = getDb();
    const result = await db.select().from(baskets).where(and(eq(baskets.id, id), eq(baskets.userId, userId)));
    if (!result.length) throw new Error('Basket not found or unauthorized');
    return result[0];
  }

  static async updateBasket(userId: string, id: string, data: Partial<Basket>): Promise<Basket> {
    const db = getDb();
    const result = await db.update(baskets)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(baskets.id, id), eq(baskets.userId, userId)))
      .returning();
    if (!result.length) throw new Error('Basket not found or unauthorized');
    return result[0];
  }

  static async deleteBasket(userId: string, id: string): Promise<void> {
    const db = getDb();
    const result = await db.delete(baskets)
      .where(and(eq(baskets.id, id), eq(baskets.userId, userId)))
      .returning();
    if (!result.length) throw new Error('Basket not found or unauthorized');
  }
}
