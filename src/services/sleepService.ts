import { getDb } from '@/db';
import { sleepLogs, userProfiles, studySessions, users } from '@/db/schemas';
import { eq, and, desc, lt } from 'drizzle-orm';
import { getLocalTimeParts } from '@/utils/timezone';
import { EmailService } from './emailService';

export interface SleepConsolidationScore {
  score: number;            // 0-100
  durationMin: number;
  studyBeforeH: number;
  quality: number;
}

export class SleepService {
  /**
   * Logs a new sleep event, automatically computing duration, study gap, and memory consolidation score.
   */
  static async logSleep(
    userId: string,
    data: {
      sleepDate: string; // ISO format or Date string
      sleepTime: string; // ISO timestamp
      wakeTime: string;  // ISO timestamp
      quality: number;   // 1-5
      notes?: string;
    }
  ) {
    const db = getDb();
    const sleepStart = new Date(data.sleepTime);
    const sleepEnd = new Date(data.wakeTime);
    
    // 1. Calculate duration in minutes
    const durationMin = Math.max(0, Math.floor((sleepEnd.getTime() - sleepStart.getTime()) / (1000 * 60)));
    
    // 2. Fetch the last study session that ended BEFORE sleepTime
    const lastSession = await db
      .select()
      .from(studySessions)
      .where(
        and(
          eq(studySessions.userId, userId),
          lt(studySessions.endedAt, sleepStart)
        )
      )
      .orderBy(desc(studySessions.endedAt))
      .limit(1);
      
    let studyBeforeH = 8; // Default fallback to a healthy gap if no recent study session exists
    if (lastSession.length > 0 && lastSession[0].endedAt) {
      const lastStudyEnd = new Date(lastSession[0].endedAt);
      const gapMs = sleepStart.getTime() - lastStudyEnd.getTime();
      studyBeforeH = Math.max(0, gapMs / (1000 * 60 * 60));
    }
    
    // 3. Compute scientific consolidation score
    const consolidationScore = this.computeConsolidationScore(durationMin, studyBeforeH, data.quality);
    
    // 4. Check if a sleep log already exists for this date, if so update it, otherwise insert
    const sleepDateParsed = new Date(data.sleepDate);
    // Standardize sleep_date to midnight UTC for date comparison
    sleepDateParsed.setUTCHours(0, 0, 0, 0);
    
    const existing = await db
      .select()
      .from(sleepLogs)
      .where(
        and(
          eq(sleepLogs.userId, userId),
          eq(sleepLogs.sleepDate, sleepDateParsed)
        )
      );
      
    const logValues = {
      userId,
      sleepDate: sleepDateParsed,
      sleepTime: sleepStart,
      wakeTime: sleepEnd,
      durationMin,
      quality: data.quality,
      studyBeforeH: Math.round(studyBeforeH),
      consolidationScore,
      notes: data.notes || null,
    };
    
    let resultLog;
    if (existing.length > 0) {
      const updated = await db
        .update(sleepLogs)
        .set(logValues)
        .where(eq(sleepLogs.id, existing[0].id))
        .returning();
      resultLog = updated[0];
    } else {
      const inserted = await db
        .insert(sleepLogs)
        .values(logValues)
        .returning();
      resultLog = inserted[0];
    }

    // Trigger outbound Resend consolidation report in the background
    const userRow = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (userRow.length > 0 && userRow[0].email) {
      EmailService.sendConsolidationReport(
        userRow[0].email,
        userRow[0].displayName || 'Scholar',
        consolidationScore,
        durationMin / 60,
        data.quality
      ).catch((e) => console.error('[SleepService] Outbound Resend email failed:', e));
    }

    return resultLog;
  }
  
  /**
   * Fetches sleep logs for a user, ordered by date descending.
   */
  static async getSleepLogs(userId: string) {
    const db = getDb();
    return db
      .select()
      .from(sleepLogs)
      .where(eq(sleepLogs.userId, userId))
      .orderBy(desc(sleepLogs.sleepDate));
  }
  
  /**
   * Evaluates if the current local time is safe for studying based on circadian bedtime.
   */
  static async isGoodStudyTime(userId: string): Promise<{ ok: boolean; urgency: 'safe' | 'warning' | 'danger'; message: string }> {
    const db = getDb();
    
    // Fetch user profile sleep time and timezone
    const profile = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
    if (profile.length === 0) {
      return { ok: true, urgency: 'safe', message: 'Circadian check safe.' };
    }
    
    const sleepTimeStr = profile[0].sleepTime || '22:30';
    const wakeTimeStr = profile[0].wakeTime || '06:30';
    const timezone = profile[0].timezone || 'UTC';
    
    try {
      const now = new Date();
      
      // Get current local hour and minute in the user's timezone using our helper
      const { hour, minute } = getLocalTimeParts(now, timezone);
      
      const nowMin = hour * 60 + minute;
      const [sleepHour, sleepMin] = sleepTimeStr.split(':').map(Number);
      const [wakeHour, wakeMin] = wakeTimeStr.split(':').map(Number);
      
      const sleepMinFromMidnight = sleepHour * 60 + sleepMin;
      const wakeMinFromMidnight = wakeHour * 60 + wakeMin;
      
      // Calculate differences
      let diffToSleep = sleepMinFromMidnight - nowMin;
      if (diffToSleep < -720) diffToSleep += 1440;
      if (diffToSleep > 720) diffToSleep -= 1440;
      
      // Danger: user is in sleep hours
      // Sleep interval is [sleepTime, wakeTime]
      let isSleeping = false;
      if (sleepMinFromMidnight < wakeMinFromMidnight) {
        isSleeping = nowMin >= sleepMinFromMidnight && nowMin <= wakeMinFromMidnight;
      } else {
        // Sleep wraps around midnight
        isSleeping = nowMin >= sleepMinFromMidnight || nowMin <= wakeMinFromMidnight;
      }
      
      if (isSleeping) {
        return {
          ok: false,
          urgency: 'danger',
          message: '🚨 Circadian sleep hours. You should be resting. Studying now severely disrupts sharp-wave ripple memory consolidation.',
        };
      }
      
      // Warning: studied within 2 hours of bedtime
      if (diffToSleep >= 0 && diffToSleep <= 120) {
        return {
          ok: false,
          urgency: 'warning',
          message: '⚠️ Late-night study window. Active recall within 2h of bed suppresses melatonin and disrupts overnight memory consolidation.',
        };
      }
      
      return {
        ok: true,
        urgency: 'safe',
        message: '✅ Safe circadian study window.',
      };
    } catch (e) {
      return { ok: true, urgency: 'safe', message: '✅ Zoned circadian study window.' };
    }
  }
  
  /**
   * Scientific algorithm computing a memory consolidation score (0-100).
   */
  private static computeConsolidationScore(
    sleepDurationMin: number,
    studyToSleepGapH: number,
    sleepQuality: number
  ): number {
    // 1. Duration score: 0 = 0h, 100 = 8h+ (480 mins)
    const durationScore = Math.min(100, (sleepDurationMin / 480) * 100);
    
    // 2. Gap score: optimal = 3-5h gap. <1h = terrible, >6h = diminishing returns
    let gapScore = 85;
    if (studyToSleepGapH < 1) gapScore = 20;
    else if (studyToSleepGapH < 2) gapScore = 50;
    else if (studyToSleepGapH < 3) gapScore = 75;
    else if (studyToSleepGapH <= 5) gapScore = 100;
    
    // 3. Quality multiplier: 0.6 to 1.0 based on 1 to 5 scale
    const qualityMultiplier = 0.6 + (sleepQuality / 5) * 0.4;
    
    const score = Math.round(((durationScore + gapScore) / 2) * qualityMultiplier);
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Completes onboarding by upserting user profile data.
   */
  static async completeOnboarding(
    userId: string,
    data: {
      sleepTime: string;
      wakeTime: string;
      timezone: string;
      learningStyle?: 'visual' | 'auditory' | 'reading' | 'kinesthetic';
      dailyGoalMin?: number;
    }
  ) {
    const db = getDb();
    
    const sleepTime = data.sleepTime || '22:30';
    const wakeTime = data.wakeTime || '06:30';
    const timezone = data.timezone || 'UTC';
    const learningStyle = data.learningStyle || 'visual';
    const dailyGoalMin = data.dailyGoalMin || 15;

    await db
      .insert(userProfiles)
      .values({
        userId,
        sleepTime,
        wakeTime,
        timezone,
        learningStyle,
        dailyGoalMin,
        onboardingDone: true,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: {
          sleepTime,
          wakeTime,
          timezone,
          learningStyle,
          dailyGoalMin,
          onboardingDone: true,
          updatedAt: new Date(),
        },
      });

    const updated = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    return updated[0];
  }
}
