import { cardStates, nodes, reviews } from '@/db/schemas';
import { processFsrsReview } from '@/lib/fsrs/engine';
import { StudyService } from '@/services/studyService';

import { getDb } from '@/db';

jest.mock('@/db', () => ({
  getDb: jest.fn(),
}));

jest.mock('@/lib/fsrs/engine', () => ({
  processFsrsReview: jest.fn(),
}));

type QueueDb = {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  transaction: jest.Mock;
};

const mockProcessFsrsReview = processFsrsReview as jest.MockedFunction<typeof processFsrsReview>;
const mockGetDb = getDb as jest.MockedFunction<typeof getDb>;

function buildDbMock(options: {
  selectQueue: unknown[][];
  insertedCardState?: Record<string, unknown>;
}) {
  const capture: {
    cardStateInsert?: Record<string, unknown>;
    reviewInsert?: Record<string, unknown>;
    cardStateUpdate?: Record<string, unknown>;
    nodeUpdate?: Record<string, unknown>;
  } = {};

  const selectQueue = [...options.selectQueue];

  const db: QueueDb = {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(async () => selectQueue.shift() ?? []),
      })),
    })),
    insert: jest.fn((table) => {
      if (table === cardStates) {
        return {
          values: jest.fn((payload) => {
            capture.cardStateInsert = payload;
            return {
              returning: jest.fn(async () => [options.insertedCardState]),
            };
          }),
        };
      }

      if (table === reviews) {
        return {
          values: jest.fn((payload) => {
            capture.reviewInsert = payload;
            return Promise.resolve();
          }),
        };
      }

      throw new Error('Unexpected insert table');
    }),
    update: jest.fn((table) => {
      if (table === cardStates) {
        return {
          set: jest.fn((payload) => {
            capture.cardStateUpdate = payload;
            return {
              where: jest.fn(async () => undefined),
            };
          }),
        };
      }

      if (table === nodes) {
        return {
          set: jest.fn((payload) => {
            capture.nodeUpdate = payload;
            return {
              where: jest.fn(async () => undefined),
            };
          }),
        };
      }

      throw new Error('Unexpected update table');
    }),
    transaction: jest.fn(async (callback) => callback(db as never)),
  };

  return { db, capture };
}

describe('StudyService.postReview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses fsrs output and persists the mapped review grade', async () => {
    const { db, capture } = buildDbMock({
      selectQueue: [
        [
          {
            id: 'card-1',
            nodeId: 'node-1',
            userId: 'user-1',
            question: 'Q',
            answer: 'A',
          },
        ],
        [
          {
            id: 'state-1',
            cardId: 'card-1',
            userId: 'user-1',
            stability: 12,
            difficulty: 5,
            elapsedDays: 2,
            scheduledDays: 4,
            reps: 3,
            lapses: 1,
            learningSteps: 2,
            state: 'Review',
            lastReview: new Date('2026-05-28T10:00:00.000Z'),
            nextReview: new Date('2026-05-31T10:00:00.000Z'),
            confidenceLast: 4,
            responseTimeMs: 900,
            masteryLevel: 'reviewing',
            updatedAt: new Date('2026-05-28T10:00:00.000Z'),
          },
        ],
        [
          {
            id: 'card-1',
            nodeId: 'node-1',
            userId: 'user-1',
          },
        ],
        [
          {
            cardId: 'card-1',
            stability: 12,
            reps: 3,
          },
        ],
      ],
    });

    mockGetDb.mockReturnValue(db as never);
    mockProcessFsrsReview.mockReturnValue({
      card: {
        due: new Date('2026-06-10T10:00:00.000Z'),
        stability: 18.4,
        difficulty: 7.2,
        elapsed_days: 2,
        scheduled_days: 10,
        learning_steps: 1,
        reps: 4,
        lapses: 1,
        state: 2,
        last_review: new Date('2026-05-31T10:00:00.000Z'),
      },
      rating: 4,
      nextReview: new Date('2026-06-10T10:00:00.000Z'),
      stateLabel: 'Review',
      masteryLevel: 'reviewing',
    });

    const result = await StudyService.postReview('user-1', {
      cardId: 'card-1',
      confidence: 5,
      wasCorrect: true,
      responseTimeMs: 1200,
    });

    expect(mockProcessFsrsReview).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'state-1', cardId: 'card-1' }),
      5,
      true,
      expect.any(Date)
    );
    expect(capture.cardStateUpdate).toMatchObject({
      stability: 18,
      difficulty: 7,
      elapsedDays: 2,
      scheduledDays: 10,
      reps: 4,
      lapses: 1,
      learningSteps: 1,
      state: 'Review',
      masteryLevel: 'reviewing',
      confidenceLast: 5,
      responseTimeMs: 1200,
    });
    expect(capture.reviewInsert).toMatchObject({
      fsrsRating: 4,
      confidence: 5,
      stabilityBefore: 12,
      stabilityAfter: 18,
      difficultyBefore: 5,
      difficultyAfter: 7,
      scheduledDays: 10,
      elapsedDays: 2,
      wasCorrect: true,
      responseTimeMs: 1200,
      reviewType: 'normal',
    });
    expect(result).toMatchObject({
      success: true,
      cardId: 'card-1',
      interval: 10,
      stability: 18,
      difficulty: 7,
    });
  });

  it('creates card state when missing before processing the review', async () => {
    const insertedState = {
      id: 'state-new',
      cardId: 'card-2',
      userId: 'user-1',
      stability: 0,
      difficulty: 0,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
      learningSteps: 0,
      state: 'New',
      lastReview: null,
      nextReview: null,
      confidenceLast: null,
      responseTimeMs: null,
      masteryLevel: 'new',
      updatedAt: new Date('2026-05-31T10:00:00.000Z'),
    };

    const { db, capture } = buildDbMock({
      selectQueue: [
        [
          {
            id: 'card-2',
            nodeId: 'node-2',
            userId: 'user-1',
            question: 'Q2',
            answer: 'A2',
          },
        ],
        [],
        [
          {
            id: 'card-2',
            nodeId: 'node-2',
            userId: 'user-1',
          },
        ],
        [
          {
            cardId: 'card-2',
            stability: 0,
            reps: 0,
          },
        ],
      ],
      insertedCardState: insertedState,
    });

    mockGetDb.mockReturnValue(db as never);
    mockProcessFsrsReview.mockReturnValue({
      card: {
        due: new Date('2026-06-01T10:00:00.000Z'),
        stability: 3.6,
        difficulty: 8.1,
        elapsed_days: 0,
        scheduled_days: 1,
        learning_steps: 1,
        reps: 1,
        lapses: 0,
        state: 1,
        last_review: new Date('2026-05-31T10:00:00.000Z'),
      },
      rating: 1,
      nextReview: new Date('2026-06-01T10:00:00.000Z'),
      stateLabel: 'Learning',
      masteryLevel: 'learning',
    });

    const result = await StudyService.postReview('user-1', {
      cardId: 'card-2',
      confidence: 1,
      wasCorrect: false,
      responseTimeMs: 800,
    });

    expect(capture.cardStateInsert).toMatchObject({
      cardId: 'card-2',
      userId: 'user-1',
      stability: 0,
      difficulty: 0,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
      learningSteps: 0,
      state: 'New',
      masteryLevel: 'new',
    });
    expect(mockProcessFsrsReview).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'state-new', cardId: 'card-2' }),
      1,
      false,
      expect.any(Date)
    );
    expect(capture.reviewInsert).toMatchObject({
      fsrsRating: 1,
      confidence: 1,
      wasCorrect: false,
      responseTimeMs: 800,
    });
    expect(result).toMatchObject({
      success: true,
      cardId: 'card-2',
      interval: 1,
      stability: 4,
      difficulty: 8,
    });
  });
});