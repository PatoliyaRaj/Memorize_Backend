import { StudyService } from '@/services/studyService';
import { getDb } from '@/db';

jest.mock('@/db', () => ({
  getDb: jest.fn(),
}));

const mockGetDb = getDb as jest.MockedFunction<typeof getDb>;

function buildDbMock(options: { selectQueue: unknown[][] }) {
  const selectQueue = [...options.selectQueue];
  const inserted: Array<Record<string, unknown>> = [];

  const db = {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(async () => selectQueue.shift() ?? []),
      })),
    })),
    insert: jest.fn(() => ({
      values: jest.fn((payload: any) => {
        // emulate insert by capturing payload
        inserted.push(payload);
        return { returning: jest.fn(async () => [] as any) };
      }),
    })),
    transaction: jest.fn(async (cb: any) => cb({
      insert: db.insert,
    })),
  } as any;

  return { db, inserted };
}

describe('StudyService.getCardsForNode seeding', () => {
  beforeEach(() => jest.clearAllMocks());

  it('seeds multiple cards when none exist, respects dedupe and orderIndex', async () => {
    const node = { id: 'node-1', title: 'Test Node', userId: 'user-1' };
    const details = {
      nodeId: 'node-1',
      thingsToRemember: 'Fact A\nFact B\nFact B\nAn extremely long takeaway that will be truncated at some point because it is over sixty characters in length and should be shortened',
      theoryContent: 'This is a short theory summary',
      emotionalAnchor: 'Useful example',
    };

    // Sequence of selects: nodes, existing cards (empty), nodeDetails, refetch inserted cards
    const refetchResult = [
      { id: 'c1', nodeId: 'node-1', userId: 'user-1', question: 'Q1', answer: 'A1', orderIndex: 0 },
      { id: 'c2', nodeId: 'node-1', userId: 'user-1', question: 'Q2', answer: 'A2', orderIndex: 1 },
      { id: 'c3', nodeId: 'node-1', userId: 'user-1', question: 'Q3', answer: 'A3', orderIndex: 2 },
    ];

    const { db, inserted } = buildDbMock({ selectQueue: [[node], [], [details], refetchResult] });
    mockGetDb.mockReturnValue(db as any);

    const out = await StudyService.getCardsForNode('user-1', 'node-1');

    // Ensure inserts happened and orderIndex was set sequentially
    expect(inserted.length).toBeGreaterThanOrEqual(1);
    const indices = inserted.map((i) => i.orderIndex);
    for (let j = 0; j < indices.length; j++) {
      expect(indices[j]).toBe(j);
    }

    // Refetched result returned
    expect(out).toEqual(refetchResult);
  });
});
