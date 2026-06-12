import { pgTable, uuid, text, integer, time, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const userProfiles = pgTable('user_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  learningStyle: text('learning_style', {
    enum: ['visual', 'auditory', 'reading', 'kinesthetic'],
  }),
  dailyGoalMin: integer('daily_goal_min').default(15),
  timezone: text('timezone').default('UTC'),
  sleepTime: time('sleep_time').default('22:30'),
  wakeTime: time('wake_time').default('06:30'),
  optimalStudyAm: time('optimal_study_am').default('08:00'),
  optimalStudyPm: time('optimal_study_pm').default('17:00'),
  streakDays: integer('streak_days').default(0).notNull(),
  lastStudyDate: timestamp('last_study_date', { withTimezone: true }),
  totalCardsMastered: integer('total_cards_mastered').default(0).notNull(),
  onboardingDone: boolean('onboarding_done').default(false).notNull(),
  academicLevel: text('academic_level'),
  studyGoals:    text('study_goals'),
  occupation:    text('occupation'),
  notificationPref: jsonb('notification_pref')
    .default(sql`'{"email":true,"push":true,"frequency":"smart"}'::jsonb`)
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
