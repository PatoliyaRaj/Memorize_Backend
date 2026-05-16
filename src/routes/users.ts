import { Router, Request, Response } from 'express';
import { UserController } from '@/controllers/UserController';
import { validateBody } from '@/middlewares/validate';
import { createUserSchema, updateUserSchema } from '@/validators/user';
import { authMiddleware } from '@/middlewares/auth';

/**
 * User Routes
 * Routes for user CRUD operations
 */

const router = Router();

/**
 * GET /api/users
 * Get all users
 */
router.get('/', (req: Request, res: Response) => {
  return UserController.getUsers(req, res);
});

/**
 * GET /api/users/:id
 * Get user by ID
 */
router.get('/:id', (req: Request, res: Response) => {
  return UserController.getUser(req, res);
});

/**
 * POST /api/users
 * Create new user (validated)
 * Note: For production, consider using /api/auth/signup instead
 */
router.post('/', validateBody(createUserSchema), (req: Request, res: Response) => {
  return UserController.createUser(req, res);
});

/**
 * PATCH /api/users/:id
 * Update user (requires authentication)
 * Users can only update their own profile
 */
router.patch('/:id', authMiddleware, validateBody(updateUserSchema), (req: Request, res: Response) => {
  return UserController.updateUser(req, res);
});

/**
 * DELETE /api/users/:id
 * Delete user (requires authentication)
 * Users can only delete their own account
 */
router.delete('/:id', authMiddleware, (req: Request, res: Response) => {
  return UserController.deleteUser(req, res);
});

export default router;
