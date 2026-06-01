import { getDb } from '@/db';
import { cards, cardStates, reviews, nodes, nodeDetails, studySessions, userProfiles } from '@/db/schemas';
import { processFsrsReview } from '@/lib/fsrs/engine';
import { eq, and, isNull, sql } from 'drizzle-orm';

type CardQuestionType = 'free_recall' | 'cloze' | 'ordering' | 'matching' | 'multiple_choice';

type CardPayload = {
  question: string;
  answer: string;
  explanation?: string;
  questionType?: CardQuestionType;
  orderIndex?: number;
};

const DEFAULT_CARD_QUESTION_TYPE: CardQuestionType = 'free_recall';

function isMissingDeletedAtColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes('deleted_at');
}

async function insertCardRecord(
  db: {
    insert: ReturnType<typeof getDb>['insert'];
    select: ReturnType<typeof getDb>['select'];
    execute: ReturnType<typeof getDb>['execute'];
  },
  payload: {
    nodeId: string;
    userId: string;
    question: string;
    answer: string;
    explanation?: string;
    questionType: CardQuestionType;
    orderIndex: number;
  }
) {
  try {
    const inserted = await db.insert(cards).values({
      nodeId: payload.nodeId,
      userId: payload.userId,
      question: payload.question,
      answer: payload.answer,
      explanation: payload.explanation,
      questionType: payload.questionType,
      orderIndex: payload.orderIndex,
    }).returning();
    return inserted[0];
  } catch (error) {
    if (!isMissingDeletedAtColumnError(error)) throw error;

    await db.execute(sql`
      insert into cards (
        node_id,
        user_id,
        question,
        answer,
        explanation,
        question_type,
        media_type,
        order_index
      ) values (
        ${payload.nodeId},
        ${payload.userId},
        ${payload.question},
        ${payload.answer},
        ${payload.explanation ?? null},
        ${payload.questionType},
        'none',
        ${payload.orderIndex}
      )
    `);

    const inserted = await db
      .select()
      .from(cards)
      .where(and(
        eq(cards.nodeId, payload.nodeId),
        eq(cards.userId, payload.userId),
        eq(cards.question, payload.question),
        eq(cards.orderIndex, payload.orderIndex),
      ));

    return inserted[0];
  }
}

async function selectActiveCards(db: ReturnType<typeof getDb>, userId: string, nodeId: string) {
  const selectShape = {
    id: cards.id,
    nodeId: cards.nodeId,
    userId: cards.userId,
    question: cards.question,
    answer: cards.answer,
    explanation: cards.explanation,
    questionType: cards.questionType,
    mediaUrl: cards.mediaUrl,
    mediaType: cards.mediaType,
    orderIndex: cards.orderIndex,
  };

  try {
    return await db
      .select(selectShape)
      .from(cards)
      .where(and(eq(cards.nodeId, nodeId), eq(cards.userId, userId), isNull(cards.deletedAt)));
  } catch (error) {
    if (!isMissingDeletedAtColumnError(error)) throw error;
    return db.select(selectShape).from(cards).where(and(eq(cards.nodeId, nodeId), eq(cards.userId, userId)));
  }
}

async function selectActiveCardById(db: ReturnType<typeof getDb>, userId: string, cardId: string) {
  try {
    const result = await db
      .select()
      .from(cards)
      .where(and(eq(cards.id, cardId), eq(cards.userId, userId), isNull(cards.deletedAt)));
    return result[0];
  } catch (error) {
    if (!isMissingDeletedAtColumnError(error)) throw error;
    const result = await db.select().from(cards).where(and(eq(cards.id, cardId), eq(cards.userId, userId)));
    return result[0];
  }
}

async function selectActiveCardByIdForNode(db: ReturnType<typeof getDb>, cardId: string) {
  try {
    const result = await db.select().from(cards).where(and(eq(cards.id, cardId), isNull(cards.deletedAt)));
    return result[0];
  } catch (error) {
    if (!isMissingDeletedAtColumnError(error)) throw error;
    const result = await db.select().from(cards).where(eq(cards.id, cardId));
    return result[0];
  }
}

export class StudyService {
  /**
   * Fetch cards for a node, auto-seeding cards if none exist.
   */
  static async getCardsForNode(userId: string, nodeId: string) {
    const db = getDb();

    // 1. Verify node exists and user owns it
    const nodeResult = await db.select().from(nodes).where(and(eq(nodes.id, nodeId), eq(nodes.userId, userId)));
    if (!nodeResult.length) {
      throw new Error('Node not found or unauthorized');
    }
    const node = nodeResult[0];

    // 2. Fetch existing cards
    let existingCards = await selectActiveCards(db, userId, nodeId);

    // 3. Auto-seed cards if empty — generate multiple atomic cards (core + takeaways + application)
    if (existingCards.length === 0) {
      const detailsResult = await db.select().from(nodeDetails).where(eq(nodeDetails.nodeId, nodeId));
      const details = detailsResult[0];

      const rawTakeaways = details?.thingsToRemember
        ? details.thingsToRemember.split('\n').map(t => t.trim()).filter(Boolean)
        : [];

      // Deduplicate and prefer short useful lines
      const takeawaysList = Array.from(new Set(rawTakeaways)).slice(0, 6);

      const maxCards = 8;
      const newCards: Array<{
        question: string;
        answer: string;
        explanation?: string;
        questionType: 'free_recall' | 'cloze' | 'ordering' | 'matching' | 'multiple_choice';
      }> = [];

      // Core concept
      newCards.push({
        question: `What is the core concept of "${node.title}"?`,
        answer: details?.theoryContent
          ? details.theoryContent
          : takeawaysList.length > 0
          ? `The core takeaways are: \n${takeawaysList.map(t => `- ${t}`).join('\n')}`
          : `The core concept is "${node.title}".`,
        explanation: details?.theoryContent || `Self-elaboration deck for ${node.title}.`,
        questionType: 'free_recall',
      });

      // Add up to 5 takeaway cards (atomic facts)
      for (let i = 0; i < takeawaysList.length && newCards.length < maxCards - 1; i++) {
        const t = takeawaysList[i];
        newCards.push({
          question: `Recall: ${t.length > 60 ? t.slice(0, 57) + '...' : t}`,
          answer: t,
          explanation: `Takeaway from ${node.title}`,
          questionType: 'free_recall',
        });
      }

      // Application / significance card (if space)
      if (newCards.length < maxCards) {
        const application = details?.emotionalAnchor || details?.theoryContent || '';
        newCards.push({
          question: `How is "${node.title}" applied or why does it matter?`,
          answer: application || `Consider real-world examples for ${node.title}.`,
          explanation: 'Application / significance',
          questionType: 'free_recall',
        });
      }

      // Hard cap and final dedupe by question text
      const seenQ = new Set<string>();
      const finalCards = newCards.filter((c) => {
        if (seenQ.has(c.question)) return false;
        seenQ.add(c.question);
        return true;
      }).slice(0, maxCards);

      // Insert all new cards in a transaction
      await db.transaction(async (tx) => {
        for (let idx = 0; idx < finalCards.length; idx++) {
          const c = finalCards[idx];
          await insertCardRecord(tx as unknown as {
            insert: ReturnType<typeof getDb>['insert'];
            select: ReturnType<typeof getDb>['select'];
            execute: ReturnType<typeof getDb>['execute'];
          }, {
            nodeId,
            userId,
            question: c.question,
            answer: c.answer,
            explanation: c.explanation,
            questionType: c.questionType,
            orderIndex: idx,
          });
        }
      });

      // Refetch inserted cards
        existingCards = await selectActiveCards(db, userId, nodeId);
    }

    return existingCards;
  }

    static async createCard(userId: string, nodeId: string, payload: CardPayload) {
      const db = getDb();

      const nodeResult = await db.select().from(nodes).where(and(eq(nodes.id, nodeId), eq(nodes.userId, userId)));
      if (!nodeResult.length) {
        throw new Error('Node not found or unauthorized');
      }

      const existingCards = await selectActiveCards(db, userId, nodeId);
      const nextOrderIndex = payload.orderIndex ?? (existingCards.length > 0
        ? Math.max(...existingCards.map((card) => card.orderIndex)) + 1
        : 0);

      const inserted = await insertCardRecord(db, {
        nodeId,
        userId,
        question: payload.question,
        answer: payload.answer,
        explanation: payload.explanation,
        questionType: payload.questionType ?? DEFAULT_CARD_QUESTION_TYPE,
        orderIndex: nextOrderIndex,
      });

      return inserted;
    }

    static async updateCard(userId: string, cardId: string, payload: Partial<CardPayload>) {
    const db = getDb();

      const cardResult = await selectActiveCardById(db, userId, cardId);
      if (!cardResult) throw new Error('Card not found or unauthorized');

    await db.update(cards).set({
      ...(payload.question !== undefined ? { question: payload.question } : {}),
      ...(payload.answer !== undefined ? { answer: payload.answer } : {}),
      ...(payload.explanation !== undefined ? { explanation: payload.explanation } : {}),
      ...(payload.orderIndex !== undefined ? { orderIndex: payload.orderIndex } : {}),
        ...(payload.questionType !== undefined ? { questionType: payload.questionType } : {}),
      updatedAt: new Date(),
    }).where(eq(cards.id, cardId));

      const updated = await selectActiveCardByIdForNode(db, cardId);
      return updated;
  }

  static async deleteCard(userId: string, cardId: string) {
    const db = getDb();
      const cardResult = await selectActiveCardById(db, userId, cardId);
      if (!cardResult) throw new Error('Card not found or unauthorized');

      try {
        await db.update(cards).set({
          deletedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(cards.id, cardId));
      } catch (error) {
        if (!isMissingDeletedAtColumnError(error)) throw error;
        await db.delete(cards).where(eq(cards.id, cardId));
      }
    return { success: true, cardId };
  }

  /**
   * Submit card review using custom scientific FSRS algorithm, logging the review and updating card mastery.
   */
  static async postReview(userId: string, data: { cardId: string; confidence: number; wasCorrect: boolean; responseTimeMs?: number; sessionId?: string; reviewType?: 'normal' | 'remedial' | 'prereq' | 'interleaved' | 'feynman' }) {
    const db = getDb();
    const { cardId, confidence, wasCorrect, responseTimeMs = 1000, sessionId, reviewType = 'normal' } = data;
    const reviewedAt = new Date();

    // 1. Verify card exists
    const cardResult = await selectActiveCardById(db, userId, cardId);
    if (!cardResult) {
      throw new Error('Card not found or unauthorized');
    }
    const card = cardResult;

    // 2. Fetch or create card state
    let stateResult = await db.select().from(cardStates).where(and(eq(cardStates.cardId, cardId), eq(cardStates.userId, userId)));
    let cardState = stateResult[0];

    if (!cardState) {
      const inserted = await db.insert(cardStates).values({
        cardId,
        userId,
        stability: 0,
        difficulty: 0,
        elapsedDays: 0,
        scheduledDays: 0,
        reps: 0,
        lapses: 0,
        learningSteps: 0,
        state: 'New',
        masteryLevel: 'new',
      }).returning();
      cardState = inserted[0];
    }

    // 3. Run the official FSRS scheduler
    const fsrsResult = processFsrsReview(cardState, confidence, wasCorrect, reviewedAt);
    const { card: updatedCard, rating, nextReview, stateLabel, masteryLevel } = fsrsResult;

    // 4. Save state
    await db.transaction(async (tx) => {
      await tx
        .update(cardStates)
        .set({
          stability: Math.round(updatedCard.stability),
          difficulty: Math.round(updatedCard.difficulty),
          elapsedDays: updatedCard.elapsed_days,
          scheduledDays: updatedCard.scheduled_days,
          reps: updatedCard.reps,
          lapses: updatedCard.lapses,
          learningSteps: updatedCard.learning_steps,
          state: stateLabel,
          masteryLevel,
          lastReview: reviewedAt,
          nextReview,
          confidenceLast: confidence,
          responseTimeMs,
          updatedAt: reviewedAt,
        })
        .where(eq(cardStates.id, cardState.id));

      // 5. Log review record
      await tx.insert(reviews).values({
        cardId,
        userId,
        sessionId: sessionId || null,
        fsrsRating: rating,
        confidence,
        stabilityBefore: cardState.stability,
        stabilityAfter: Math.round(updatedCard.stability),
        difficultyBefore: cardState.difficulty,
        difficultyAfter: Math.round(updatedCard.difficulty),
        scheduledDays: updatedCard.scheduled_days,
        elapsedDays: updatedCard.elapsed_days,
        wasCorrect,
        responseTimeMs,
        reviewType,
      });

      // 5b. Update study session atomic counters if sessionId is provided
      if (sessionId) {
        await tx.execute(sql`
          UPDATE study_sessions
          SET cards_reviewed = cards_reviewed + 1,
              cards_correct = cards_correct + ${wasCorrect ? 1 : 0}
          WHERE id = ${sessionId}::uuid AND user_id = ${userId}::uuid
        `);
      }

      // 6. Propagate node mastery level
      // Calculate overall node mastery from all cards inside this node
      let allNodeCards;
      try {
        allNodeCards = await tx.select().from(cards).where(and(eq(cards.nodeId, card.nodeId), isNull(cards.deletedAt)));
      } catch (error) {
        if (!isMissingDeletedAtColumnError(error)) throw error;
        allNodeCards = await tx.select().from(cards).where(eq(cards.nodeId, card.nodeId));
      }
      const cardIds = allNodeCards.map(c => c.id);
      
      const allStates = await tx.select().from(cardStates).where(and(eq(cardStates.userId, userId)));
      const relevantStates = allStates.filter(s => cardIds.includes(s.cardId));

      let totalStability = 0;
      let totalReps = 0;
      relevantStates.forEach(s => {
        totalStability += s.stability;
        totalReps += s.reps;
      });

      const avgStability = relevantStates.length > 0 ? (totalStability / relevantStates.length) : 0;
      const currentLapses = updatedCard.lapses;
      
      let nodeMastery: 'unseen' | 'weak' | 'learning' | 'strong' | 'mastered' = 'learning';
      if (totalReps === 0) {
        nodeMastery = 'unseen';
      } else if (!wasCorrect && currentLapses > 2) {
        nodeMastery = 'weak';
      } else if (avgStability > 30) {
        nodeMastery = 'mastered';
      } else if (avgStability > 10) {
        nodeMastery = 'strong';
      }

      await tx
        .update(nodes)
        .set({
          masteryLevel: nodeMastery,
          updatedAt: new Date(),
        })
        .where(eq(nodes.id, card.nodeId));
    });

    return {
      success: true,
      cardId,
      nextReview,
      interval: updatedCard.scheduled_days,
      stability: Math.round(updatedCard.stability),
      difficulty: Math.round(updatedCard.difficulty),
    };
  }

  /**
   * Start a new study session, resolving sleep window safety status.
   */
  static async startStudySession(userId: string, payload: { basketId?: string; mode?: 'normal' | 'interleaved' | 'exam' | 'remedial' | 'prereq'; notes?: string }) {
    const db = getDb();
    
    // 1. Fetch user's sleep time and timezone
    const profile = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
    const sleepTime = profile[0]?.sleepTime || '22:30';
    const timezone = profile[0]?.timezone || 'UTC';
    
    // 2. Resolve sleep window safety
    const sleepWindowOk = isSleepWindowOk(sleepTime, timezone);
    
    // 3. Create session row
    const inserted = await db.insert(studySessions).values({
      userId,
      basketId: payload.basketId || null,
      mode: payload.mode || 'normal',
      sleepWindowOk,
      notes: payload.notes || null,
    }).returning();
    
    return inserted[0];
  }

  /**
   * End an active study session, computing its total duration in seconds.
   */
  static async endStudySession(userId: string, sessionId: string, payload: { notes?: string }) {
    const db = getDb();
    
    // 1. Fetch session
    const sessionResult = await db.select().from(studySessions).where(and(eq(studySessions.id, sessionId), eq(studySessions.userId, userId)));
    if (!sessionResult.length) {
      throw new Error('Study session not found or unauthorized');
    }
    const session = sessionResult[0];
    
    const endedAt = new Date();
    const startedAt = new Date(session.startedAt);
    const durationSec = Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000));
    
    // 2. Update session
    const updated = await db
      .update(studySessions)
      .set({
        endedAt,
        durationSec,
        notes: payload.notes !== undefined ? payload.notes : session.notes,
      })
      .where(eq(studySessions.id, sessionId))
      .returning();
      
    return updated[0];
  }
}

/**
 * Checks if studying now is in a safe memory consolidation sleep window (not close to bedtime or during sleep).
 */
function isSleepWindowOk(sleepTimeStr: string, timezone: string): boolean {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);

    const [sleepHour, sleepMin] = sleepTimeStr.split(':').map(Number);
    
    const nowMin = hour * 60 + minute;
    const sleepMinFromMidnight = sleepHour * 60 + sleepMin;

    // Bedtime warning window is [sleepTime - 120 mins, sleepTime + 480 mins]
    let adjustedDiff = sleepMinFromMidnight - nowMin;
    if (adjustedDiff < -720) adjustedDiff += 1440;
    if (adjustedDiff > 720) adjustedDiff -= 1440;

    if (adjustedDiff >= 0 && adjustedDiff <= 120) {
      return false; // studied within 2 hours of bedtime
    }
    
    let adjustedPast = nowMin - sleepMinFromMidnight;
    if (adjustedPast < -720) adjustedPast += 1440;
    if (adjustedPast > 720) adjustedPast -= 1440;
    
    if (adjustedPast >= 0 && adjustedPast <= 480) {
      return false; // studied during sleep hours
    }

    return true;
  } catch (e) {
    return true; // Fallback
  }
}
