import { getDb } from '@/db';
import { cards, cardStates, nodes, playlists, subjects, baskets, pulseQueues, userProfiles } from '@/db/schemas';
import { eq, and, isNull, sql } from 'drizzle-orm';

export interface PulseQueueItem {
  cardId: string;
  nodeId: string;
  nodeTitle: string;
  playlistId: string;
  playlistTitle: string;
  subjectId: string;
  subjectTitle: string;
  basketId: string;
  basketTitle: string;
  question: string;
  answer: string;
  explanation: string | null;
  questionType: string;
  type: 'warmup' | 'due' | 'weak' | 'expansion';
  reviewedToday: boolean;
}

let indexesCreated = false;

async function ensureIndexes() {
  if (indexesCreated) return;
  const db = getDb();
  try {
    // Attempt to create partial database performance indexes for Pulse queries
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_edges_prerequisite 
        ON edges(edge_type, target_node_id) 
        WHERE edge_type = 'prerequisite_of';
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_card_states_user_due 
        ON card_states(user_id, next_review);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_pulse_queues_user_date 
        ON pulse_queues(user_id, queue_date);
    `);
    indexesCreated = true;
  } catch (e) {
    console.warn('[PulseService] Database index auto-creation warning (non-fatal):', e);
  }
}

export class PulseService {
  /**
   * Fetches today's daily study queue. If it does not exist, generates and persists it.
   */
  static async getOrCreateQueue(userId: string, targetDate: string) {
    await ensureIndexes();
    const db = getDb();

    // 1. Check if queue already exists for today
    const existing = await db
      .select()
      .from(pulseQueues)
      .where(and(eq(pulseQueues.userId, userId), eq(pulseQueues.queueDate, targetDate)));

    if (existing.length > 0) {
      // Return with updated status (reviewedToday check)
      const queueCards = existing[0].cards as PulseQueueItem[];
      const updatedQueue = await this.refreshQueueCardStatus(userId, queueCards);
      
      // Update completion status in db if fully reviewed
      const allCompleted = updatedQueue.length > 0 && updatedQueue.every(c => c.reviewedToday);
      if (allCompleted && !existing[0].completed) {
        await db.update(pulseQueues).set({ completed: true }).where(eq(pulseQueues.id, existing[0].id));
      }

      return {
        id: existing[0].id,
        userId: existing[0].userId,
        queueDate: existing[0].queueDate,
        cards: updatedQueue,
        completed: allCompleted,
        generatedAt: existing[0].generatedAt,
      };
    }

    // 2. Generate new queue
    const newQueue = await this.generateQueue(userId, targetDate);

    // 3. Save queue to database with concurrency race protection
    try {
      const inserted = await db.insert(pulseQueues).values({
        userId,
        queueDate: targetDate,
        cards: newQueue,
        completed: false,
      }).returning();

      return inserted[0];
    } catch (error) {
      // Concurrency protection: if insert fails due to duplicate key, refetch the existing row
      console.log('[PulseService] Parallel query conflict caught, returning existing queue.');
      const conflictFetch = await db
        .select()
        .from(pulseQueues)
        .where(and(eq(pulseQueues.userId, userId), eq(pulseQueues.queueDate, targetDate)));
      
      if (conflictFetch.length > 0) {
        const queueCards = conflictFetch[0].cards as PulseQueueItem[];
        const updatedQueue = await this.refreshQueueCardStatus(userId, queueCards);
        return {
          id: conflictFetch[0].id,
          userId: conflictFetch[0].userId,
          queueDate: conflictFetch[0].queueDate,
          cards: updatedQueue,
          completed: updatedQueue.length > 0 && updatedQueue.every(c => c.reviewedToday),
          generatedAt: conflictFetch[0].generatedAt,
        };
      }
      throw error;
    }
  }

  /**
   * Forces the regeneration of today's study queue.
   */
  static async regenerateQueue(userId: string, targetDate: string) {
    await ensureIndexes();
    const db = getDb();

    // 1. Delete today's queue if it exists
    await db.delete(pulseQueues).where(and(eq(pulseQueues.userId, userId), eq(pulseQueues.queueDate, targetDate)));

    // 2. Re-create the queue
    return this.getOrCreateQueue(userId, targetDate);
  }

  /**
   * Generates the optimized daily study queue in memory.
   */
  private static async generateQueue(userId: string, _targetDate: string): Promise<PulseQueueItem[]> {
    const db = getDb();

    // 1. Fetch user profile limits
    const profileResult = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
    const dailyGoalMin = profileResult[0]?.dailyGoalMin ?? 15;
    // Cap daily budget based on goal (approx 1.5 cards per minute, max 30)
    const dailyGoalBudget = Math.min(30, Math.max(10, Math.round(dailyGoalMin * 1.5)));

    // 2. Fetch all cards with schema-level deleted_at column backward-compatibility
    let allCardsData: any[] = [];
    const selectShape = {
      cardId: cards.id,
      nodeId: cards.nodeId,
      nodeTitle: nodes.title,
      masteryLevel: nodes.masteryLevel,
      playlistId: playlists.id,
      playlistTitle: playlists.title,
      subjectId: subjects.id,
      subjectTitle: subjects.title,
      basketId: baskets.id,
      basketTitle: baskets.title,
      question: cards.question,
      answer: cards.answer,
      explanation: cards.explanation,
      questionType: cards.questionType,
      state: cardStates.state,
      lapses: cardStates.lapses,
      difficulty: cardStates.difficulty,
      nextReview: cardStates.nextReview,
      lastReview: cardStates.lastReview,
    };

    try {
      allCardsData = await db
        .select(selectShape)
        .from(cards)
        .innerJoin(nodes, eq(cards.nodeId, nodes.id))
        .innerJoin(playlists, eq(nodes.playlistId, playlists.id))
        .innerJoin(subjects, eq(playlists.subjectId, subjects.id))
        .innerJoin(baskets, eq(subjects.basketId, baskets.id))
        .leftJoin(cardStates, and(eq(cards.id, cardStates.cardId), eq(cardStates.userId, userId)))
        .where(and(eq(cards.userId, userId), isNull(cards.deletedAt)));
    } catch (e) {
      // Fallback: older database structure without deletedAt
      allCardsData = await db
        .select(selectShape)
        .from(cards)
        .innerJoin(nodes, eq(cards.nodeId, nodes.id))
        .innerJoin(playlists, eq(nodes.playlistId, playlists.id))
        .innerJoin(subjects, eq(playlists.subjectId, subjects.id))
        .innerJoin(baskets, eq(subjects.basketId, baskets.id))
        .leftJoin(cardStates, and(eq(cards.id, cardStates.cardId), eq(cardStates.userId, userId)))
        .where(eq(cards.userId, userId));
    }

    if (allCardsData.length === 0) {
      return [];
    }

    // 3. Category Separation
    const now = new Date();
    const lookaheadDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24-hour lookahead

    const dueCards: any[] = [];
    const weakCards: any[] = [];
    const newCards: any[] = [];

    allCardsData.forEach(card => {
      if (!card.state || card.state === 'New') {
        newCards.push(card);
      } else {
        const nextReviewDate = card.nextReview ? new Date(card.nextReview) : null;
        const isLapsedWeak = card.lapses > 2 || card.difficulty > 7;

        if (nextReviewDate && nextReviewDate <= lookaheadDate) {
          dueCards.push(card);
        } else if (isLapsedWeak) {
          weakCards.push(card);
        }
      }
    });

    // 4. Graph Recursive CTE: Fetch prerequisite mapping with cycle prevention
    let prereqEdges: any[] = [];
    try {
      const result = await db.execute(sql`
        WITH RECURSIVE prereq_chain AS (
          SELECT source_node_id, target_node_id, 1 as depth, ARRAY[source_node_id]::uuid[] as path
          FROM edges 
          WHERE edge_type = 'prerequisite_of' AND user_id = ${userId}::uuid
          
          UNION ALL
          
          SELECT e.source_node_id, e.target_node_id, pc.depth + 1, pc.path || e.source_node_id
          FROM edges e 
          JOIN prereq_chain pc ON e.target_node_id = pc.source_node_id
          WHERE e.edge_type = 'prerequisite_of' 
            AND e.user_id = ${userId}::uuid
            AND pc.depth < 10
            AND NOT e.source_node_id = ANY(pc.path) -- ✅ Prevents circular edge hangs
        )
        SELECT DISTINCT source_node_id as "sourceNodeId", target_node_id as "targetNodeId", depth FROM prereq_chain;
      `);
      prereqEdges = result as unknown as any[];
    } catch (e) {
      console.warn('[PulseService] Recursive CTE error (skipping warmup sorting):', e);
    }

    // Build prerequisite map in-memory
    // targetNodeId -> Set of sourceNodeId (prereqs)
    const prereqMap = new Map<string, Set<string>>();
    prereqEdges.forEach((edge: any) => {
      const target = edge.targetNodeId;
      const source = edge.sourceNodeId;
      if (!prereqMap.has(target)) {
        prereqMap.set(target, new Set());
      }
      prereqMap.get(target)!.add(source);
    });

    // 5. 70/30 Interleaving (Basket-Constrained)
    let primarySubjectId = '';
    let primaryCards: any[] = [];
    let interleavedCards: any[] = [];

    // Group due cards by Subject
    const dueBySubject = new Map<string, any[]>();
    dueCards.forEach(c => {
      if (!dueBySubject.has(c.subjectId)) dueBySubject.set(c.subjectId, []);
      dueBySubject.get(c.subjectId)!.push(c);
    });

    // Determine primary subject (one with most due cards)
    let maxDue = 0;
    dueBySubject.forEach((cards, subId) => {
      if (cards.length > maxDue) {
        maxDue = cards.length;
        primarySubjectId = subId;
      }
    });

    if (primarySubjectId) {
      primaryCards = dueBySubject.get(primarySubjectId) || [];
      const primaryBasketId = primaryCards[0]?.basketId;

      // Locate interleaved partner subject in the same Basket
      let interleavePartnerSubjectId = '';
      let partnerMaxDue = 0;

      dueBySubject.forEach((cards, subId) => {
        if (subId !== primarySubjectId && cards[0]?.basketId === primaryBasketId) {
          if (cards.length > partnerMaxDue) {
            partnerMaxDue = cards.length;
            interleavePartnerSubjectId = subId;
          }
        }
      });

      if (interleavePartnerSubjectId) {
        interleavedCards = dueBySubject.get(interleavePartnerSubjectId) || [];
      } else {
        // Fine-grained fallback: Playlist-level interleaving within the same primary subject
        const dueByPlaylist = new Map<string, any[]>();
        primaryCards.forEach(c => {
          if (!dueByPlaylist.has(c.playlistId)) dueByPlaylist.set(c.playlistId, []);
          dueByPlaylist.get(c.playlistId)!.push(c);
        });

        let primaryPlaylistId = '';
        let maxPlaylistDue = 0;
        dueByPlaylist.forEach((cards, playId) => {
          if (cards.length > maxPlaylistDue) {
            maxPlaylistDue = cards.length;
            primaryPlaylistId = playId;
          }
        });

        let interleavePlaylistId = '';
        let playlistPartnerMaxDue = 0;
        dueByPlaylist.forEach((cards, playId) => {
          if (playId !== primaryPlaylistId) {
            if (cards.length > playlistPartnerMaxDue) {
              playlistPartnerMaxDue = cards.length;
              interleavePlaylistId = playId;
            }
          }
        });

        if (primaryPlaylistId) {
          primaryCards = dueByPlaylist.get(primaryPlaylistId) || [];
          if (interleavePlaylistId) {
            interleavedCards = dueByPlaylist.get(interleavePlaylistId) || [];
          }
        }
      }
    } else {
      // If no due cards, use any available basket / subject for new/weak cards
      const allActive = [...weakCards, ...newCards];
      if (allActive.length > 0) {
        primaryCards = allActive.filter(c => c.subjectId === allActive[0].subjectId);
      }
    }

    // Allocate 70/30 budget
    const primaryBudget = Math.round(dailyGoalBudget * 0.7);
    const interleavedBudget = dailyGoalBudget - primaryBudget;

    const selectedPrimary = primaryCards.slice(0, primaryBudget);
    const selectedInterleaved = interleavedCards.slice(0, interleavedBudget);

    // Merge core FSRS reviews
    const coreReviews: any[] = [];
    const maxLength = Math.max(selectedPrimary.length, selectedInterleaved.length);
    for (let i = 0; i < maxLength; i++) {
      if (i < selectedPrimary.length) coreReviews.push(selectedPrimary[i]);
      if (i < selectedInterleaved.length) coreReviews.push(selectedInterleaved[i]);
    }

    // 6. Warmup Node Prerequisites (Capped at exactly 5 cards)
    const activeNodeIds = new Set(coreReviews.map(c => c.nodeId));
    const warmupCandidates: any[] = [];
    const warmupNodeIds = new Set<string>();

    activeNodeIds.forEach(nodeId => {
      const prereqs = prereqMap.get(nodeId);
      if (prereqs) {
        prereqs.forEach(prereqNodeId => {
          // If the prerequisite node is unmastered
          const prereqCards = allCardsData.filter(c => c.nodeId === prereqNodeId);
          const isUnmastered = prereqCards.some(c => c.masteryLevel !== 'mastered' && c.masteryLevel !== 'strong');
          
          if (isUnmastered && !activeNodeIds.has(prereqNodeId) && !warmupNodeIds.has(prereqNodeId)) {
            prereqCards.forEach(c => {
              warmupCandidates.push(c);
            });
            warmupNodeIds.add(prereqNodeId);
          }
        });
      }
    });

    const warmupBlock = warmupCandidates.slice(0, 5); // Hard cap at 5 cards to prevent cognitive exhaustion

    // 7. Remedial Weak Cards
    // Select up to 3 weak cards that are not already in our core queue
    const coreCardIds = new Set(coreReviews.map(c => c.cardId));
    const warmupCardIds = new Set(warmupBlock.map(c => c.cardId));
    
    const remedialBlock = weakCards
      .filter(c => !coreCardIds.has(c.cardId) && !warmupCardIds.has(c.cardId))
      .slice(0, 3);

    // 8. New Card Synaptic Expansion (Capped at exactly 5 cards)
    const expansionBlock = newCards
      .filter(c => !coreCardIds.has(c.cardId) && !warmupCardIds.has(c.cardId))
      .slice(0, 5);

    // 9. Sequence and Format final queue items
    const finalQueue: PulseQueueItem[] = [];

    const formatItem = (card: any, type: PulseQueueItem['type']): PulseQueueItem => ({
      cardId: card.cardId,
      nodeId: card.nodeId,
      nodeTitle: card.nodeTitle,
      playlistId: card.playlistId,
      playlistTitle: card.playlistTitle,
      subjectId: card.subjectId,
      subjectTitle: card.subjectTitle,
      basketId: card.basketId,
      basketTitle: card.basketTitle,
      question: card.question,
      answer: card.answer,
      explanation: card.explanation || null,
      questionType: card.questionType,
      type,
      reviewedToday: false,
    });

    warmupBlock.forEach(c => finalQueue.push(formatItem(c, 'warmup')));
    coreReviews.forEach(c => finalQueue.push(formatItem(c, 'due')));
    remedialBlock.forEach(c => finalQueue.push(formatItem(c, 'weak')));
    expansionBlock.forEach(c => finalQueue.push(formatItem(c, 'expansion')));

    // De-duplicate final queue just in case
    const seen = new Set<string>();
    return finalQueue.filter(item => {
      if (seen.has(item.cardId)) return false;
      seen.add(item.cardId);
      return true;
    });
  }

  /**
   * Refreshes the queue item status by checking if cards were reviewed today.
   */
  private static async refreshQueueCardStatus(userId: string, queue: PulseQueueItem[]): Promise<PulseQueueItem[]> {
    const db = getDb();
    const cardIds = queue.map(q => q.cardId);
    if (cardIds.length === 0) return [];

    // Query card states to see if they've been reviewed today
    const states = await db
      .select({ cardId: cardStates.cardId, lastReview: cardStates.lastReview })
      .from(cardStates)
      .where(and(eq(cardStates.userId, userId)));

    const statesMap = new Map<string, Date>();
    states.forEach(s => {
      if (s.lastReview) {
        statesMap.set(s.cardId, new Date(s.lastReview));
      }
    });

    // Check if review occurred since midnight local time today
    // We can assume if lastReview exists and is today, it's completed.
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Local midnight comparison

    return queue.map(item => {
      const lastReview = statesMap.get(item.cardId);
      return {
        ...item,
        reviewedToday: !!lastReview && lastReview >= today,
      };
    });
  }
}
