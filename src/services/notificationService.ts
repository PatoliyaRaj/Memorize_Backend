import { getDb } from '@/db';
import { notifications, userProfiles, studySessions, pushSubscriptions } from '@/db/schemas';
import { eq, and, desc, gte } from 'drizzle-orm';
import { getLocalTimeParts } from '@/utils/timezone';
import { Response } from 'express';
import webpush from 'web-push';

export class NotificationService {
  private static clients = new Map<string, Response[]>();
  private static isVapidInitialized = false;

  private static initVapid() {
    if (this.isVapidInitialized) return;
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:admin@neurolearn.dev',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      );
      this.isVapidInitialized = true;
    } else {
      console.warn('[NotificationService] VAPID keys are missing. Offline Web Push alerts are disabled.');
    }
  }

  static addClient(userId: string, res: Response) {
    const list = this.clients.get(userId) || [];
    list.push(res);
    this.clients.set(userId, list);

    res.on('close', () => {
      this.removeClient(userId, res);
    });
  }

  static removeClient(userId: string, res: Response) {
    const list = this.clients.get(userId) || [];
    const index = list.indexOf(res);
    if (index !== -1) {
      list.splice(index, 1);
    }
    if (list.length === 0) {
      this.clients.delete(userId);
    } else {
      this.clients.set(userId, list);
    }
  }

  static pushToClient(userId: string, data: any) {
    const list = this.clients.get(userId) || [];
    for (const client of list) {
      client.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  }

  static async createNotification(
    userId: string,
    data: {
      type: string;
      title: string;
      body: string;
    }
  ) {
    const db = getDb();
    const inserted = await db
      .insert(notifications)
      .values({
        userId,
        type: data.type,
        title: data.title,
        body: data.body,
        read: false,
      })
      .returning();

    const newNotification = inserted[0];
    
    // Broadcast via SSE and Web Push in background
    this.sendRealtimeNotification(userId, newNotification).catch((e) =>
      console.error('[NotificationService] Realtime broadcast failed:', e)
    );

    return newNotification;
  }

  static async sendRealtimeNotification(userId: string, notification: any) {
    // 1. Push to active SSE streams
    this.pushToClient(userId, notification);

    // 2. Broadcast via offline Web Push
    this.initVapid();
    if (!this.isVapidInitialized) return;

    try {
      const db = getDb();
      const subs = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, userId));

      for (const sub of subs) {
        const pushConfig = {
          endpoint: sub.endpoint,
          keys: {
            auth: sub.auth,
            p256dh: sub.p256dh,
          },
        };

        webpush.sendNotification(
          pushConfig,
          JSON.stringify({
            title: notification.title,
            body: notification.body,
            url: '/dashboard',
          })
        ).catch((e: any) => {
          console.warn(`[NotificationService] Offline push failed for endpoint: ${sub.endpoint}. Status: ${e.statusCode}`);
          // Prune expired subscriptions automatically
          if (e.statusCode === 410 || e.statusCode === 404) {
            db.delete(pushSubscriptions)
              .where(eq(pushSubscriptions.id, sub.id))
              .catch((err) => console.error('[NotificationService] Expired subscription prune failed:', err));
          }
        });
      }
    } catch (e) {
      console.error('[NotificationService] Error executing push broadcast:', e);
    }
  }
  /**
   * Fetch all notifications for a user, ordered by sentAt descending.
   */
  static async getNotifications(userId: string) {
    const db = getDb();
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.sentAt))
      .limit(30);
  }

  /**
   * Marks a single notification as read.
   */
  static async markAsRead(userId: string, id: string) {
    const db = getDb();
    const updated = await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    return updated[0];
  }

  /**
   * Marks all notifications for a user as read.
   */
  static async markAllAsRead(userId: string) {
    const db = getDb();
    const updated = await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
      .returning();
    return updated;
  }

  /**
   * Core Bedtime Notification Engine.
   * Scans all user profiles, computes local times, enforces safe circadian windows,
   * and creates a study review reminder 3 hours before typical sleep time.
   */
  static async triggerSmartBedtimeNotifications() {
    const db = getDb();
    
    // 1. Fetch all user profiles
    const profiles = await db.select().from(userProfiles);
    const now = new Date();
    
    const results = [];
    
    for (const profile of profiles) {
      const { userId, sleepTime, timezone } = profile;
      const sleepTimeStr = sleepTime || '22:30';
      const timezoneStr = timezone || 'UTC';
      
      try {
        // Resolve current hour/minute in the user's localized timezone using our helper
        const { hour: localHour, minute: localMinute } = getLocalTimeParts(now, timezoneStr);
        
        const nowLocalMin = localHour * 60 + localMinute;
        const [sleepHour, sleepMin] = sleepTimeStr.split(':').map(Number);
        const sleepLocalMin = sleepHour * 60 + sleepMin;
        
        // Calculate minutes remaining until typical bedtime
        let diffMinutes = sleepLocalMin - nowLocalMin;
        if (diffMinutes < -720) diffMinutes += 1440;
        if (diffMinutes > 720) diffMinutes -= 1440;
        
        // ---------------------------------------------------------------------
        // Strategic Rule 1 & 3 Check:
        // Trigger if localized time is roughly 3 hours before sleepTime (180 mins).
        // Using a 60-minute window (e.g. 150 to 210 mins before bed) to ensure
        // cron executes at least once inside the hour.
        // ---------------------------------------------------------------------
        const isInNotificationTargetWindow = diffMinutes >= 150 && diffMinutes <= 210;
        
        // Bedtime Lockout: DO NOT alert within 60 minutes of bedtime or during sleep hours
        const isBedtimeLockoutActive = diffMinutes >= -480 && diffMinutes <= 60;
        
        if (isInNotificationTargetWindow && !isBedtimeLockoutActive) {
          // Calculate start of today in localized time to check study history
          const localTodayStart = new Date();
          localTodayStart.setHours(localTodayStart.getHours() - localHour);
          localTodayStart.setMinutes(0);
          localTodayStart.setSeconds(0);
          
          // A. Verify if they completed any study sessions today
          const todaySessions = await db
            .select()
            .from(studySessions)
            .where(
              and(
                eq(studySessions.userId, userId),
                gte(studySessions.startedAt, localTodayStart)
              )
            );
            
          if (todaySessions.length === 0) {
            // User did not study today, no bedtime review is necessary
            continue;
          }
          
          // B. Verify if we already created a 'study_reminder' notification today
          const existingTodayAlerts = await db
            .select()
            .from(notifications)
            .where(
              and(
                eq(notifications.userId, userId),
                eq(notifications.type, 'study_reminder'),
                gte(notifications.sentAt, localTodayStart)
              )
            );
            
          if (existingTodayAlerts.length > 0) {
            // Already notified today
            continue;
          }
          
          // C. Create the premium Smart Bedtime Notification
          const count = todaySessions.reduce((acc, s) => acc + (s.cardsReviewed || 0), 0);
          const title = "⚡ Review Today's Concepts";
          const body = count > 0
            ? `You studied ${count} cards today! Take 5 minutes to review them now. Priming these concepts 3 hours before sleep maximizes NREM slow-wave consolidation.`
            : `You studied today! Take 5 minutes to perform a quick bedtime active recall review to lock these memories into your neocortex overnight.`;
            
          const alert = await this.createNotification(userId, {
            type: 'study_reminder',
            title,
            body,
          });
          
          results.push(alert);
        }
      } catch (e) {
        console.error(`[NotificationService] Error executing zoned check for user ${userId}:`, e);
      }
    }
    
    return results;
  }

  /**
   * Saves or updates a user's browser push notification subscription token.
   */
  static async subscribePush(
    userId: string,
    subscription: {
      endpoint: string;
      keys: {
        auth: string;
        p256dh: string;
      };
    }
  ) {
    const db = getDb();
    
    const existing = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
      .limit(1);

    const values = {
      userId,
      endpoint: subscription.endpoint,
      auth: subscription.keys.auth,
      p256dh: subscription.keys.p256dh,
    };

    if (existing.length > 0) {
      const updated = await db
        .update(pushSubscriptions)
        .set(values)
        .where(eq(pushSubscriptions.id, existing[0].id))
        .returning();
      return updated[0];
    } else {
      const inserted = await db
        .insert(pushSubscriptions)
        .values(values)
        .returning();
      return inserted[0];
    }
  }
}
