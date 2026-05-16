import { type Playlist, type NewPlaylist } from '@/model/types';
import { getDb } from '@/db';
import { playlists } from '@/db/schemas';
import { eq, and } from 'drizzle-orm';

export class PlaylistService {
  static async createPlaylist(userId: string, data: Omit<NewPlaylist, 'userId' | 'id'>): Promise<Playlist> {
    const db = getDb();
    const result = await db.insert(playlists).values({
      ...data,
      userId,
    }).returning();
    return result[0];
  }

  static async getPlaylistsBySubject(userId: string, subjectId: string): Promise<Playlist[]> {
    const db = getDb();
    return db.select().from(playlists).where(
      and(eq(playlists.subjectId, subjectId), eq(playlists.userId, userId))
    );
  }

  static async getPlaylistById(userId: string, id: string): Promise<Playlist> {
    const db = getDb();
    const result = await db.select().from(playlists).where(and(eq(playlists.id, id), eq(playlists.userId, userId)));
    if (!result.length) throw new Error('Playlist not found or unauthorized');
    return result[0];
  }

  static async updatePlaylist(userId: string, id: string, data: Partial<Playlist>): Promise<Playlist> {
    const db = getDb();
    const result = await db.update(playlists)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(playlists.id, id), eq(playlists.userId, userId)))
      .returning();
    if (!result.length) throw new Error('Playlist not found or unauthorized');
    return result[0];
  }

  static async deletePlaylist(userId: string, id: string): Promise<void> {
    const db = getDb();
    const result = await db.delete(playlists)
      .where(and(eq(playlists.id, id), eq(playlists.userId, userId)))
      .returning();
    if (!result.length) throw new Error('Playlist not found or unauthorized');
  }
}
