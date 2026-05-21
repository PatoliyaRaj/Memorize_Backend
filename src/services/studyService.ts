import { getDb } from '@/db';
import { cards, cardStates, reviews, nodes, nodeDetails } from '@/db/schemas';
import { eq, and } from 'drizzle-orm';

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
    let existingCards = await db
      .select({
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
      })
      .from(cards)
      .where(and(eq(cards.nodeId, nodeId), eq(cards.userId, userId)));

    // 3. Auto-seed cards if empty
    if (existingCards.length === 0) {
      const detailsResult = await db.select().from(nodeDetails).where(eq(nodeDetails.nodeId, nodeId));
      const details = detailsResult[0];
      
      const takeawaysList = details?.thingsToRemember
        ? details.thingsToRemember.split('\n').filter(Boolean)
        : [];

      // Card 1: Core Concept recall
      const q1 = `What is the core concept of "${node.title}"?`;
      const a1 = takeawaysList.length > 0
        ? `The core takeaways are: \n${takeawaysList.map(t => `- ${t}`).join('\n')}`
        : `The core concept is "${node.title}".`;
      const exp1 = details?.theoryContent || `Self-elaboration deck for ${node.title}.`;

      // Card 2: Technical/Application Recall
      const q2 = `How is "${node.title}" applied? Explain its significance or emotional anchor.`;
      const a2 = details?.emotionalAnchor
        ? `Anchor: ${details.emotionalAnchor}\n\nTheory Context: ${details.theoryContent || 'Underlying theory context.'}`
        : `Theory context: ${details.theoryContent || 'Underlying theory context.'}`;
      const exp2 = `Active recall trigger for ${node.title}.`;

      await db.transaction(async (tx) => {
        await tx.insert(cards).values({
          nodeId,
          userId,
          question: q1,
          answer: a1,
          explanation: exp1,
          questionType: 'free_recall',
          orderIndex: 0,
        });

        await tx.insert(cards).values({
          nodeId,
          userId,
          question: q2,
          answer: a2,
          explanation: exp2,
          questionType: 'free_recall',
          orderIndex: 1,
        });
      });

      // Refetch
      existingCards = await db
        .select({
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
        })
        .from(cards)
        .where(and(eq(cards.nodeId, nodeId), eq(cards.userId, userId)));
    }

    return existingCards;
  }

  /**
   * Submit card review using custom scientific FSRS algorithm, logging the review and updating card mastery.
   */
  static async postReview(userId: string, data: { cardId: string; confidence: number; wasCorrect: boolean; responseTimeMs?: number }) {
    const db = getDb();
    const { cardId, confidence, wasCorrect, responseTimeMs = 1000 } = data;

    // 1. Verify card exists
    const cardResult = await db.select().from(cards).where(and(eq(cards.id, cardId), eq(cards.userId, userId)));
    if (!cardResult.length) {
      throw new Error('Card not found or unauthorized');
    }
    const card = cardResult[0];

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
        state: 'New',
        masteryLevel: 'new',
      }).returning();
      cardState = inserted[0];
    }

    // 3. FSRS update calculations
    const reps = cardState.reps + 1;
    const lapses = wasCorrect ? cardState.lapses : cardState.lapses + 1;
    const oldState = cardState.state;
    const newState = wasCorrect ? 'Review' : 'Relearning';

    let difficulty = cardState.difficulty;
    let stability = cardState.stability;
    let interval = 1;

    if (!wasCorrect) {
      // Penalty: Reset stability, increase difficulty
      difficulty = Math.min(100, difficulty + 15);
      stability = Math.max(1, Math.round(stability * 0.4));
      interval = 1;
    } else {
      // Success: recalculate metrics
      if (oldState === 'New' || stability === 0) {
        stability = confidence * 2;
        difficulty = Math.max(10, 50 - (confidence - 3) * 10);
        interval = confidence;
      } else {
        difficulty = Math.max(1, Math.min(100, difficulty - Math.round((confidence - 3) * 4)));
        stability = Math.round(stability * (1 + (confidence - 2) * 0.45));
        interval = stability;
      }
    }

    // Caps & schedules
    if (interval > 365) interval = 365;
    
    // Set nextReview early in the morning to prevent clumping (e.g. 4:00 AM)
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);
    nextReview.setHours(4, 0, 0, 0);

    let cardMastery: 'new' | 'learning' | 'reviewing' | 'mastered' = 'learning';
    if (stability > 30) {
      cardMastery = 'mastered';
    } else if (stability > 10) {
      cardMastery = 'reviewing';
    } else if (!wasCorrect) {
      cardMastery = 'learning';
    }

    // 4. Save state
    await db.transaction(async (tx) => {
      await tx
        .update(cardStates)
        .set({
          stability,
          difficulty,
          elapsedDays: interval,
          scheduledDays: interval,
          reps,
          lapses,
          state: newState,
          masteryLevel: cardMastery,
          lastReview: new Date(),
          nextReview,
          confidenceLast: confidence,
          responseTimeMs,
          updatedAt: new Date(),
        })
        .where(eq(cardStates.id, cardState.id));

      // 5. Log review record
      await tx.insert(reviews).values({
        cardId,
        userId,
        fsrsRating: confidence,
        confidence,
        stabilityBefore: cardState.stability,
        stabilityAfter: stability,
        difficultyBefore: cardState.difficulty,
        difficultyAfter: difficulty,
        scheduledDays: interval,
        elapsedDays: interval,
        wasCorrect,
        responseTimeMs,
        reviewType: 'normal',
      });

      // 6. Propagate node mastery level
      // Calculate overall node mastery from all cards inside this node
      const allNodeCards = await tx.select().from(cards).where(eq(cards.nodeId, card.nodeId));
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
      
      let nodeMastery: 'unseen' | 'weak' | 'learning' | 'strong' | 'mastered' = 'learning';
      if (totalReps === 0) {
        nodeMastery = 'unseen';
      } else if (!wasCorrect && lapses > 2) {
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
      interval,
      stability,
      difficulty,
    };
  }
}
