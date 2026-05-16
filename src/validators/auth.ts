import { z } from 'zod';

/**
 * Auth validator schemas
 * Used for signup and login validation
 */

export const signupSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .min(1, 'Email is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(
      /[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]/,
      'Password must contain at least one special character'
    ),
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(100, 'Display name must be less than 100 characters')
    .optional(),
});

export const loginSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .min(1, 'Email is required'),
  password: z
    .string()
    .min(1, 'Password is required'),
});

/**
 * Response types for auth endpoints
 */
export const authSuccessResponseSchema = z.object({
  token: z.string().describe('JWT access token'),
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    displayName: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),
});

export type SignupRequest = z.infer<typeof signupSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type AuthSuccessResponse = z.infer<typeof authSuccessResponseSchema>;
