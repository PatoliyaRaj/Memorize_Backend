import { Rating } from 'ts-fsrs';

import {
  buildFsrsCard,
  calculateMasteryLevel,
  mapConfidenceToRating,
  processFsrsReview,
} from '@/lib/fsrs/engine';

describe('fsrs engine', () => {
  it('maps confidence and correctness to fsrs ratings', () => {
    expect(mapConfidenceToRating(1, false)).toBe(Rating.Again);
    expect(mapConfidenceToRating(2, true)).toBe(Rating.Hard);
    expect(mapConfidenceToRating(3, true)).toBe(Rating.Good);
    expect(mapConfidenceToRating(5, true)).toBe(Rating.Easy);
  });

  it('builds an fsrs card from stored state and prefers next review over last review', () => {
    const reviewedAt = new Date('2026-05-31T10:00:00.000Z');
    const nextReview = new Date('2026-06-01T12:00:00.000Z');

    const card = buildFsrsCard(
      {
        state: 'Learning',
        stability: 12,
        difficulty: 6,
        elapsedDays: 2,
        scheduledDays: 4,
        reps: 3,
        lapses: 1,
        learningSteps: 2,
        lastReview: new Date('2026-05-30T08:00:00.000Z'),
        nextReview,
      },
      reviewedAt
    );

    expect(card.due).toBe(nextReview);
    expect(card.learning_steps).toBe(2);
    expect(card.reps).toBe(3);
    expect(card.state).toBe('Learning');
  });

  it('processes a review with the official scheduler and returns stable output', () => {
    const reviewedAt = new Date('2026-05-31T10:00:00.000Z');

    const result = processFsrsReview(
      {
        state: 'New',
        stability: 0,
        difficulty: 0,
        elapsedDays: 0,
        scheduledDays: 0,
        reps: 0,
        lapses: 0,
        learningSteps: 0,
        lastReview: null,
        nextReview: null,
      },
      5,
      true,
      reviewedAt
    );

    expect(result.rating).toBe(Rating.Easy);
    expect(result.nextReview).toBeInstanceOf(Date);
    expect(result.nextReview.getTime()).toBeGreaterThan(reviewedAt.getTime());
    expect(result.card.reps).toBe(1);
    expect(['Learning', 'Review', 'Relearning']).toContain(result.stateLabel);
    expect(['learning', 'reviewing', 'mastered']).toContain(result.masteryLevel);
  });

  it('keeps mastery levels aligned with fsrs state labels', () => {
    expect(calculateMasteryLevel('New', 0)).toBe('new');
    expect(calculateMasteryLevel('Learning', 50)).toBe('learning');
    expect(calculateMasteryLevel('Relearning', 50)).toBe('learning');
    expect(calculateMasteryLevel('Review', 5)).toBe('learning');
    expect(calculateMasteryLevel('Review', 15)).toBe('reviewing');
    expect(calculateMasteryLevel('Review', 35)).toBe('mastered');
  });
});