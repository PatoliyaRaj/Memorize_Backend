import { Request, Response } from 'express';
import { getDb } from '@/db';
import { userProfiles } from '@/db/schemas';
import { PulseService } from '@/services/pulseService';
import { toUserLocalDate } from '@/utils/timezone';
import logger from '@/utils/logger';
import { eq } from 'drizzle-orm';

export class PulseController {
  /**
   * GET /api/pulse
   * Retrieves or builds the today's daily study queue.
   */
  static async getTodayQueue(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const db = getDb();

      // 1. Fetch user's profile to obtain their timezone
      const profile = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
      const timezone = profile[0]?.timezone || 'UTC';

      // 2. Resolve target local date YYYY-MM-DD
      const localDate = toUserLocalDate(new Date(), timezone);

      // 3. Fetch or generate queue
      const queue = await PulseService.getOrCreateQueue(userId, localDate);
      res.status(200).json(queue);
    } catch (error: any) {
      logger.error('Failed to retrieve daily Pulse queue', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
    }
  }

  /**
   * POST /api/pulse/regenerate
   * Force-regenerates and replaces the today's daily study queue.
   */
  static async forceRegenerateQueue(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const db = getDb();

      // 1. Fetch user's timezone
      const profile = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
      const timezone = profile[0]?.timezone || 'UTC';

      // 2. Resolve local date
      const localDate = toUserLocalDate(new Date(), timezone);

      // 3. Force-regenerate
      const queue = await PulseService.regenerateQueue(userId, localDate);
      res.status(200).json(queue);
    } catch (error: any) {
      logger.error('Failed to force-regenerate daily Pulse queue', { error: error.message });
      res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
    }
  }
}
