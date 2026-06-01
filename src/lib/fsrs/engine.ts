import { fsrs, Rating, State, type Card, type CardInput, type FSRSParameters } from 'ts-fsrs';

import type { CardState } from '@/db/schemas';

export type FsrsStateLabel = 'New' | 'Learning' | 'Review' | 'Relearning';

export type FsrsMasteryLevel = 'new' | 'learning' | 'reviewing' | 'mastered';

export type CardStateInput = Pick<
  CardState,
  | 'state'
  | 'stability'
  | 'difficulty'
  | 'elapsedDays'
  | 'scheduledDays'
  | 'reps'
  | 'lapses'
  | 'learningSteps'
  | 'lastReview'
  | 'nextReview'
>;

export type FsrsReviewResult = {
  card: Card;
  rating: Rating;
  nextReview: Date;
  stateLabel: FsrsStateLabel;
  masteryLevel: FsrsMasteryLevel;
};

const fsrsScheduler = fsrs({
  request_retention: 0.9,
  maximum_interval: 365,
  enable_fuzz: true,
  enable_short_term: true,
  learning_steps: ['1m', '10m'],
  relearning_steps: ['10m'],
} as Partial<FSRSParameters>);

export function mapConfidenceToRating(confidence: number, wasCorrect: boolean): Rating {
  if (!wasCorrect) return Rating.Again;
  if (confidence <= 2) return Rating.Hard;
  if (confidence <= 4) return Rating.Good;
  return Rating.Easy;
}

export function buildFsrsCard(cardState: CardStateInput, reviewedAt: Date): CardInput {
  return {
    due: cardState.nextReview ?? cardState.lastReview ?? reviewedAt,
    stability: cardState.stability,
    difficulty: cardState.difficulty,
    elapsed_days: cardState.elapsedDays,
    scheduled_days: cardState.scheduledDays,
    learning_steps: cardState.learningSteps,
    reps: cardState.reps,
    lapses: cardState.lapses,
    state: cardState.state,
    last_review: cardState.lastReview ?? undefined,
  };
}

export function calculateMasteryLevel(stateLabel: FsrsStateLabel, stability: number): FsrsMasteryLevel {
  if (stateLabel === 'New') return 'new';
  if (stateLabel === 'Learning' || stateLabel === 'Relearning') return 'learning';
  if (stability > 30) return 'mastered';
  if (stability > 10) return 'reviewing';
  return 'learning';
}

export function processFsrsReview(
  cardState: CardStateInput,
  confidence: number,
  wasCorrect: boolean,
  reviewedAt: Date = new Date()
): FsrsReviewResult {
  const rating = mapConfidenceToRating(confidence, wasCorrect);
  const currentCard = buildFsrsCard(cardState, reviewedAt);
  const result = fsrsScheduler.next(currentCard, reviewedAt, rating as 1 | 2 | 3 | 4);
  const stateLabel = State[result.card.state] as FsrsStateLabel;

  return {
    card: result.card,
    rating,
    nextReview: result.card.due,
    stateLabel,
    masteryLevel: calculateMasteryLevel(stateLabel, result.card.stability),
  };
}

export { Rating, State };