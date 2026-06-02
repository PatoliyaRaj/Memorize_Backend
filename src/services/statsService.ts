import { getDb } from '@/db';
import { reviews, cardStates, sleepLogs, cards, nodes } from '@/db/schemas';
import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';

export class StatsService {
  /**
   * Projects active recall retention probability over the next 30 days.
   * Formula: R = 0.9^(t / stability)
   */
  static async getRetentionData(userId: string) {
    const db = getDb();
    const activeStates = await db
      .select({
        stability: cardStates.stability,
        reps: cardStates.reps,
      })
      .from(cardStates)
      .where(and(eq(cardStates.userId, userId), sql`${cardStates.reps} > 0`));

    if (activeStates.length === 0) {
      return {
        averageStabilityDays: 0,
        projectedRetention: Array.from({ length: 30 }, (_, i) => ({ day: i, retention: 100 })),
      };
    }

    let sumStability = 0;
    activeStates.forEach((s) => {
      sumStability += s.stability;
    });
    const averageStabilityDays = Math.round((sumStability / activeStates.length) * 10) / 10;

    // Calculate average projected retention for each day (0 to 30)
    const projectedRetention = [];
    for (let day = 0; day <= 30; day++) {
      let sumProb = 0;
      activeStates.forEach((s) => {
        // Stability cap to prevent divide by zero
        const stability = Math.max(1, s.stability);
        // Probability of recall R = 0.9^(day / stability)
        const r = Math.pow(0.9, day / stability);
        sumProb += r;
      });
      const avgRet = Math.round((sumProb / activeStates.length) * 1000) / 10;
      projectedRetention.push({ day, retention: avgRet });
    }

    return {
      averageStabilityDays,
      projectedRetention,
    };
  }

  /**
   * Aggregates reviews count per day over the past 365 days for GitHub-style heatmap.
   */
  static async getHeatmapData(userId: string) {
    const db = getDb();
    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);

    const result = await db
      .select({
        date: sql<string>`DATE(${reviews.reviewedAt})`,
        count: sql<number>`COUNT(${reviews.id})::int`,
      })
      .from(reviews)
      .where(and(eq(reviews.userId, userId), gte(reviews.reviewedAt, oneYearAgo)))
      .groupBy(sql`DATE(${reviews.reviewedAt})`);

    return result.map((r) => ({
      date: r.date,
      count: r.count,
    }));
  }

  /**
   * Retrieves nodes/cards with high lapses or low correct rates ("leeches").
   */
  static async getWeakSpots(userId: string) {
    const db = getDb();
    const weakSpots = await db
      .select({
        cardId: cards.id,
        question: cards.question,
        nodeTitle: nodes.title,
        lapses: cardStates.lapses,
        difficulty: cardStates.difficulty,
        reps: cardStates.reps,
      })
      .from(cardStates)
      .innerJoin(cards, eq(cardStates.cardId, cards.id))
      .innerJoin(nodes, eq(cards.nodeId, nodes.id))
      .where(and(eq(cardStates.userId, userId), gte(cardStates.lapses, 1)))
      .orderBy(desc(cardStates.lapses))
      .limit(8);

    return weakSpots;
  }

  /**
   * Correlates sleep consolidation scores with the next day's recall accuracy.
   */
  static async getSleepCorrelation(userId: string) {
    const db = getDb();
    
    // Fetch last 30 sleep logs
    const logs = await db
      .select()
      .from(sleepLogs)
      .where(eq(sleepLogs.userId, userId))
      .orderBy(desc(sleepLogs.sleepDate))
      .limit(30);

    if (logs.length === 0) {
      return [];
    }

    const correlations = [];

    for (const log of logs) {
      const sleepDay = new Date(log.sleepDate);
      const nextDayStart = new Date(sleepDay);
      nextDayStart.setDate(nextDayStart.getDate() + 1);
      nextDayStart.setHours(0, 0, 0, 0);

      const nextDayEnd = new Date(nextDayStart);
      nextDayEnd.setHours(23, 59, 59, 999);

      // Fetch reviews completed on the day after the sleep session
      const dayReviews = await db
        .select({
          wasCorrect: reviews.wasCorrect,
        })
        .from(reviews)
        .where(
          and(
            eq(reviews.userId, userId),
            gte(reviews.reviewedAt, nextDayStart),
            lte(reviews.reviewedAt, nextDayEnd)
          )
        );

      let accuracy = 100;
      if (dayReviews.length > 0) {
        const correct = dayReviews.filter((r) => r.wasCorrect).length;
        accuracy = Math.round((correct / dayReviews.length) * 100);
      } else {
        // Skip dates with no study logs to keep the correlation clean
        continue;
      }

      correlations.push({
        date: sleepDay.toISOString().split('T')[0],
        sleepScore: log.consolidationScore || 0,
        sleepDurationH: Math.round(((log.durationMin || 0) / 60) * 10) / 10,
        sleepQuality: log.quality || 0,
        recallAccuracy: accuracy,
        reviewsCount: dayReviews.length,
      });
    }

    return correlations;
  }
}
