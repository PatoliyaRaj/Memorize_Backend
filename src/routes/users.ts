import { Router, Request, Response } from 'express';
import { UserController } from '@/controllers/UserController';
import { validateBody } from '@/middlewares/validate';
import { createUserSchema, updateUserSchema } from '@/validators/user';

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
 */
router.post('/', validateBody(createUserSchema), (req: Request, res: Response) => {
  return UserController.createUser(req, res);
});

/**
 * PATCH /api/users/:id
 * Update user
 */
router.patch('/:id', validateBody(updateUserSchema), (req: Request, res: Response) => {
  return UserController.updateUser(req, res);
});

/**
 * DELETE /api/users/:id
 * Delete user
 */
router.delete('/:id', (req: Request, res: Response) => {
  return UserController.deleteUser(req, res);
});

export default router;
