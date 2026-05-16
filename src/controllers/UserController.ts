import { Request, Response } from 'express';
import { UserService } from '@/services/UserService';
import { type NewUser } from '@/model/types';
import logger from '@/utils/logger';

/**
 * User Controller
 * Handles HTTP requests for user operations
 */

export class UserController {
  /**
   * GET /users/:id
   */
  static async getUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = await UserService.getUserById(id);

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({ data: user });
      logger.info("User fetched successfully",{user})
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: message });
      logger.error("Failed to fetch user",{message})
    }
  }

  /**
   * GET /users
   */
  static async getUsers(_req: Request, res: Response): Promise<void> {
    try {
      const users = await UserService.getAllUsers();
      res.json({ data: users, count: users.length });
      logger.info("Users fetched successfully",{users})
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: message });
      logger.error("Failed to fetch users",{message})
    }
  }

  /**
   * POST /users
   */
  static async createUser(req: Request, res: Response): Promise<void> {
    try {
      const userData: NewUser = req.body;
      const user = await UserService.createUser(userData);

      res.status(201).json({ data: user });
      logger.info("User created successfully",{user})
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: message });
      logger.error("Failed to create user",{message})
    }
  }

  /**
   * PATCH /users/:id
   * Update user (requires authentication)
   * Users can only update their own profile
   */
  static async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Ownership check: authenticated user can only update their own profile
      if (req.user && req.user.id !== id) {
        res.status(403).json({
          success: false,
          error: 'You can only update your own profile',
        });
        return;
      }

      const user = await UserService.updateUser(id, updates);

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({ data: user });
      logger.info("User updated successfully",{user})
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: message });
      logger.error("Failed to update user",{message})
    }
  }

  /**
   * DELETE /users/:id
   * Delete user (requires authentication)
   * Users can only delete their own account
   */
  static async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Ownership check: authenticated user can only delete their own account
      if (req.user && req.user.id !== id) {
        res.status(403).json({
          success: false,
          error: 'You can only delete your own account',
        });
        logger.error("User not authorized to delete", {userId: id})
        return;
      }

      const success = await UserService.deleteUser(id);

      if (!success) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.status(204).send();
      logger.info("User deleted successfully", {userId: id})
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: message });
      logger.error("Failed to delete user", {message})
    }
  }
}
