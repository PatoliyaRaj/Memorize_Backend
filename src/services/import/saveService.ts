import { getDb }          from '../../db';
import { nodeDetails } from '../../db/schemas/nodeDetails';
import { cards }       from '../../db/schemas/cards';
import { cardStates }  from '../../db/schemas/cardStates';
import { syncImportedCards } from './syncService';
import { createEmptyCard } from 'ts-fsrs';
import { eq, inArray, and } from 'drizzle-orm';

interface SavePayload {
  nodeId: string;
  fields: { theoryContent?: string; thingsToRemember?: string; references?: any[]; emotionalAnchor?: string; isImportant?: boolean; };
  cards: Array<{ question: string; answer: string; questionType: string; subTopic?: string; explanation?: string; }>;
}

export async function saveImport(data: SavePayload, userId: string) {
  const db = getDb();
  return db.transaction(async (tx) => {

    // 1. Fetch existing non-deleted cards for this node
    const existing = await tx.select({
      id: cards.id, question: cards.question, answer: cards.answer,
      orderIndex: cards.orderIndex, explanation: cards.explanation,
    }).from(cards).where(and(eq(cards.nodeId, data.nodeId), eq(cards.userId, userId)));

    const { cardsToCreate, cardIdsToSoftDelete, cardsToUpdate, telemetry } = syncImportedCards(existing, data.cards);

    // 2. Log sync telemetry
    console.log(JSON.stringify({ event: 'import_sync', nodeId: data.nodeId, userId,
      created: cardsToCreate.length, updated: cardsToUpdate.length, softDeleted: cardIdsToSoftDelete.length,
      avgSimilarity: telemetry.avgSimilarity.toFixed(3), perfectMatches: telemetry.perfectMatches,
    }));

    // 3. Upsert node_details
    await tx.insert(nodeDetails).values({
      nodeId: data.nodeId,
      theoryContent: data.fields.theoryContent ?? '',
      thingsToRemember: data.fields.thingsToRemember ?? '',
      references: data.fields.references ?? [],
      emotionalAnchor: data.fields.emotionalAnchor ?? '',
      isImportant: data.fields.isImportant ?? false,
      updatedAt: new Date(),
    }).onConflictDoUpdate({ target: nodeDetails.nodeId, set: {
      theoryContent: data.fields.theoryContent ?? '',
      thingsToRemember: data.fields.thingsToRemember ?? '',
      references: data.fields.references ?? [],
      emotionalAnchor: data.fields.emotionalAnchor ?? '',
      isImportant: data.fields.isImportant ?? false,
      updatedAt: new Date(),
    }});

    // 4. Soft delete (not hard delete) — preserves card_states history
    if (cardIdsToSoftDelete.length > 0) {
      await tx.update(cards).set({ deletedAt: new Date() }).where(inArray(cards.id, cardIdsToSoftDelete));
    }

    // 5. Update matched cards (answer/order changed, FSRS state preserved)
    for (const u of cardsToUpdate) {
      await tx.update(cards).set({ question: u.question, answer: u.answer, orderIndex: u.orderIndex, explanation: u.explanation }).where(eq(cards.id, u.id));
    }

    // 6. Create new cards with FSRS state + jitter
    const created = [];
    for (const [i, c] of cardsToCreate.entries()) {
      const explanation = JSON.stringify({ subTopic: c.subTopic || 'General', text: c.explanation || '' });
      const [newCard] = await tx.insert(cards).values({
        nodeId: data.nodeId, userId,
        question: c.question, answer: c.answer,
        questionType: (c.questionType as any) || 'free_recall',
        orderIndex: existing.length - cardIdsToSoftDelete.length + i,
        explanation,
      }).returning();

      const empty = createEmptyCard();
      const jitter = Math.floor(Math.random() * 45 * 60 * 1000); // 0–45 min spread (Approach 2)
      await tx.insert(cardStates).values({
        cardId: newCard.id, userId,
        stability: Math.round(empty.stability),
        difficulty: Math.round(empty.difficulty),
        elapsedDays: empty.elapsed_days,
        scheduledDays: empty.scheduled_days,
        reps: empty.reps,
        lapses: empty.lapses,
        state: 'New',
        masteryLevel: 'new',
        nextReview: new Date(Date.now() + jitter),
      });
      created.push(newCard);
    }

    return { nodeId: data.nodeId, created: created.length, updated: cardsToUpdate.length, softDeleted: cardIdsToSoftDelete.length };
  });
}
