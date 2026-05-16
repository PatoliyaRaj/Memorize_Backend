import { Router, Request, Response } from 'express';
import { AuthController } from '@/controllers/authController';
import { validateBody } from '@/middlewares/validate';
import { signupSchema, loginSchema } from '@/validators/auth';

/**
 * Auth Routes
 * Routes for authentication (signup, login)
 */

const router = Router();

/**
 * POST /api/auth/signup
 * Register a new user
 * Body: { email, password, firstName, lastName, age }
 */
router.post('/signup', validateBody(signupSchema), (req: Request, res: Response) => {
  return AuthController.signup(req, res);
});

/**
 * POST /api/auth/login
 * Login user and receive JWT token
 * Body: { email, password }
 */
router.post('/login', validateBody(loginSchema), (req: Request, res: Response) => {
  return AuthController.login(req, res);
});

export default router;
