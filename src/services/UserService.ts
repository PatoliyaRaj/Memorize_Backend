import { UserRepository } from '@/repositories';
import { type User, type NewUser } from '@/db/schemas';
import { hashPassword } from '@/utils/password';

/**
 * User Service
 * Contains business logic for user operations.
 * Uses the new schema (passwordHash, displayName, no firstName/lastName/age).
 */

export class UserService {
  private static sanitizeUser(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash: _, ...sanitized } = user;
    return sanitized;
  } 

  /**
   * Get user by ID (sanitized — no passwordHash)
   */
  static async getUserById(id: string): Promise<Omit<User, 'passwordHash'> | null> {
    try {
      const user = await UserRepository.findById(id);
      return user ? this.sanitizeUser(user) : null;
    } catch (error) {
      throw new Error(`Failed to get user: ${error}`);
    }
  }

  /**
   * Get user by email
   * @param includePasswordHash - true only in AuthService.login for password verification
   */
  static async getUserByEmail(email: string, includePasswordHash = false): Promise<User | null> {
    try {
      const user = await UserRepository.findByEmail(email);
      if (user && !includePasswordHash) {
        return this.sanitizeUser(user) as User;
      }
      return user ?? null;
    } catch (error) {
      throw new Error(`Failed to get user: ${error}`);
    }
  }

  /**
   * Get all users (sanitized)
   */
  static async getAllUsers(): Promise<Omit<User, 'passwordHash'>[]> {
    try {
      const users = await UserRepository.findAll();
      return users.map((user) => this.sanitizeUser(user));
    } catch (error) {
      throw new Error(`Failed to fetch users: ${error}`);
    }
  }

  /**
   * Create new user.
   * If passwordHash is plain text (doesn't start with $2b$), it will be hashed.
   * In normal flow, AuthService hashes first and passes the hash here.
   */
  static async createUser(userData: NewUser): Promise<User> {
    try {
      if (!userData.email) {
        throw new Error('Missing required field: email');
      }

      const existing = await UserRepository.findByEmail(userData.email);
      if (existing) {
        throw new Error('User with this email already exists');
      }

      // Auto-hash if plain text was accidentally passed
      let passwordHashToStore = userData.passwordHash;
      if (
        passwordHashToStore &&
        !passwordHashToStore.startsWith('$2b$') &&
        !passwordHashToStore.startsWith('$2y$') &&
        !passwordHashToStore.startsWith('$2a$')
      ) {
        passwordHashToStore = await hashPassword(passwordHashToStore);
      }

      return await UserRepository.create({
        ...userData,
        passwordHash: passwordHashToStore,
      });
    } catch (error) {
      throw new Error(`Failed to create user: ${error}`);
    }
  }

  /**
   * Update user fields (email, displayName, avatarUrl)
   * Password changes must go through AuthService to ensure hashing.
   */
  static async updateUser(
    id: string,
    updates: Partial<Pick<NewUser, 'email' | 'displayName' | 'avatarUrl'>>
  ): Promise<User | undefined> {
    try {
      const user = await UserRepository.findById(id);
      if (!user) return undefined;

      if (updates.email && updates.email !== user.email) {
        const existing = await UserRepository.findByEmail(updates.email);
        if (existing) throw new Error('Email already in use');
      }

      return await UserRepository.update(id, updates);
    } catch (error) {
      throw new Error(`Failed to update user: ${error}`);
    }
  }

  /**
   * Delete user
   */
  static async deleteUser(id: string): Promise<boolean> {
    try {
      const user = await UserRepository.findById(id);
      if (!user) return false;
      return await UserRepository.delete(id);
    } catch (error) {
      throw new Error(`Failed to delete user: ${error}`);
    }
  }
}
