import { UserService } from './UserService';
import { hashPassword, verifyPassword } from '@/utils/password';
import { signToken } from '@/utils/jwt';
import type { User, NewUser } from '@/db/schemas';

/**
 * User data without sensitive passwordHash field
 */
export type SanitizedUser = Omit<User, 'passwordHash'>;

/**
 * Auth Service
 * Handles signup, login, and token generation
 */

export class AuthService {
  /**
   * Signup a new user
   * @param email User email (must be unique)
   * @param password Plain-text password (will be hashed)
   * @param firstName User first name
   * @param lastName User last name
   * @param age User age
   * @returns { token, user } on success
   * @throws Error if email already exists or validation fails
   */
  static async signup(
    email: string,
    password: string,
    displayName?: string
  ): Promise<{ token: string; user: SanitizedUser }> {
    try {
      const existing = await UserService.getUserByEmail(email);
      if (existing) {
        throw new Error('User with this email already exists');
      }

      const hashedPassword = await hashPassword(password);

      const newUser: NewUser = {
        email,
        passwordHash: hashedPassword,
        displayName: displayName ?? null,
      };

      const user = await UserService.createUser(newUser);

      const token = signToken({ userId: user.id, email: user.email });

      return {
        token,
        user: this.sanitizeUser(user),
      };
    } catch (error) {
      throw new Error(`Signup failed: ${error}`);
    }
  }

  /**
   * Login with email and password
   * @param email User email
   * @param password Plain-text password
   * @returns { token, user } on success
   * @throws Error if credentials are invalid
   */
  static async login(
    email: string,
    password: string
  ): Promise<{ token: string; user: SanitizedUser }> {
    try {
      // Find user by email
      const user = await UserService.getUserByEmail(email, true);

      if (!user || !user.passwordHash) {
        throw new Error('Invalid credentials');
      }

      const isPasswordValid = await verifyPassword(password, user.passwordHash);
      if (!isPasswordValid) {
        throw new Error('Invalid credentials');
      }

      // Generate JWT
      const token = signToken({ userId: user.id, email: user.email });

      // Return token and user (without password)
      return {
        token,
        user: this.sanitizeUser(user),
      };
    } catch (error) {
      // Don't leak auth errors - always say "Invalid credentials"
      if (error instanceof Error && error.message === 'Invalid credentials') {
        throw error;
      }
      if (error instanceof Error && error.message === 'Account is inactive') {
        throw error;
      }
      throw new Error('Invalid credentials');
    }
  }

  /**
   * Remove sensitive fields from user object before sending to client
   * @param user User object from database
   * @returns Sanitized user object (no password hash)
   */
  private static sanitizeUser(user: User): SanitizedUser {
    const { passwordHash: _, ...sanitized } = user;
    return sanitized;
  }
}

