import { UserRepository } from '@/repositories';
import { type User, type NewUser } from '@/model/types';

/**
 * User Service
 * Contains business logic for user operations
 */

export class UserService {
  /**
   * Get user by ID
   */
  static async getUserById(id: string): Promise<User | null> {
    try {
      const user = await UserRepository.findById(id);
      return user || null;
    } catch (error) {
      throw new Error(`Failed to get user: ${error}`);
    }
  }

  /**
   * Get user by email
   */
  static async getUserByEmail(email: string): Promise<User | null> {
    try {
      const user = await UserRepository.findByEmail(email);
      return user || null;
    } catch (error) {
      throw new Error(`Failed to get user: ${error}`);
    }
  }

  /**
   * Get all users
   */
  static async getAllUsers(): Promise<User[]> {
    try {
      return await UserRepository.findAll();
    } catch (error) {
      throw new Error(`Failed to fetch users: ${error}`);
    }
  }

  /**
   * Create new user
   */
  static async createUser(userData: NewUser): Promise<User> {
    try {
      // Validation could go here
      if (!userData.email || !userData.firstName || !userData.lastName) {
        throw new Error('Missing required fields');
      }

      // Check if user already exists
      const existing = await UserRepository.findByEmail(userData.email);
      if (existing) {
        throw new Error('User with this email already exists');
      }

      return await UserRepository.create(userData);
    } catch (error) {
      throw new Error(`Failed to create user: ${error}`);
    }
  }

  /**
   * Update user
   */
  static async updateUser(id: string, updates: Partial<NewUser>): Promise<User | undefined> {
    try {
      const user = await UserRepository.findById(id);
      if (!user) {
        return undefined;
      }

      if (updates.email && updates.email !== user.email) {
        const existing = await UserRepository.findByEmail(updates.email);
        if (existing) {
          throw new Error('Email already in use');
        }
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
      if (!user) {
        return false;
      }
      return await UserRepository.delete(id);
    } catch (error) {
      throw new Error(`Failed to delete user: ${error}`);
    }
  }

  /**
   * Activate user
   */
  static async activateUser(id: string): Promise<User | undefined> {
    return this.updateUser(id, { isActive: true });
  }

  /**
   * Deactivate user
   */
  static async deactivateUser(id: string): Promise<User | undefined> {
    return this.updateUser(id, { isActive: false });
  }
}
