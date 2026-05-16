import { type Subject, type NewSubject } from '@/model/types';
import { getDb } from '@/db';
import { subjects } from '@/db/schemas';
import { eq, and } from 'drizzle-orm';

export class SubjectService {
  static async createSubject(userId: string, data: Omit<NewSubject, 'userId' | 'id'>): Promise<Subject> {
    const db = getDb();
    const result = await db.insert(subjects).values({
      ...data,
      userId,
    }).returning();
    return result[0];
  }

  static async getSubjectsByBasket(userId: string, basketId: string): Promise<Subject[]> {
    const db = getDb();
    return db.select().from(subjects).where(
      and(eq(subjects.basketId, basketId), eq(subjects.userId, userId))
    );
  }

  static async getSubjectById(userId: string, id: string): Promise<Subject> {
    const db = getDb();
    const result = await db.select().from(subjects).where(and(eq(subjects.id, id), eq(subjects.userId, userId)));
    if (!result.length) throw new Error('Subject not found or unauthorized');
    return result[0];
  }

  static async updateSubject(userId: string, id: string, data: Partial<Subject>): Promise<Subject> {
    const db = getDb();
    const result = await db.update(subjects)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(subjects.id, id), eq(subjects.userId, userId)))
      .returning();
    if (!result.length) throw new Error('Subject not found or unauthorized');
    return result[0];
  }

  static async deleteSubject(userId: string, id: string): Promise<void> {
    const db = getDb();
    const result = await db.delete(subjects)
      .where(and(eq(subjects.id, id), eq(subjects.userId, userId)))
      .returning();
    if (!result.length) throw new Error('Subject not found or unauthorized');
  }
}
