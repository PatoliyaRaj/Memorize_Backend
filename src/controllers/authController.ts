import { Request, Response } from 'express';
import { AuthService } from '@/services/AuthService';
import { signupSchema, loginSchema } from '@/validators/auth';
import logger from '@/utils/logger';

/**
 * Auth Controller
 * Handles signup and login endpoints
 */

export class AuthController {
  /**
   * POST /api/auth/signup
   * Register a new user
   * Body: { email, password, firstName, lastName, age }
   */
  static async signup(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const data = signupSchema.parse(req.body);

      // Create user and generate token
      const { token, user } = await AuthService.signup(
        data.email,
        data.password,
        data.displayName
      );

      res.status(201).json({
        success: true,
        token,
        user,
      });
      logger.info("User created successfully",{user})
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Signup failed';

      // Prevent leaking specific error details to client
      if (message.includes('already exists')) {
        res.status(409).json({
          success: false,
          error: 'Email already registered',
        });
        logger.error("User already exists", {message})
      } else if (message.includes('Invalid')) {
        res.status(400).json({
          success: false,
          error: message,
        });
        logger.error("Invalid input", {message})
      } else {
        res.status(500).json({
          success: false,
          error: `Internal server error - ${message}`,
        });
        logger.error("Internal server error", {message})
      }
    }
  }

  /**
   * POST /api/auth/login
   * Authenticate user and return JWT
   * Body: { email, password }
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const data = loginSchema.parse(req.body);

      // Verify credentials and generate token
      const { token, user } = await AuthService.login(data.email, data.password);

      res.status(200).json({
        success: true,
        token,
        user,
      });
      logger.info("User logged in successfully",{user})
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';

      // All auth failures return 401 with generic message
      if (message === 'Invalid credentials' || message === 'Account is inactive') {
        res.status(401).json({
          success: false,
          error: 'Invalid credentials',
        });
        logger.error("Invalid credentials", {message})
      } else if (message.includes('Invalid')) {
        res.status(400).json({
          success: false,
          error: message,
        });
        logger.error("Invalid input", {message})
      } else {
        res.status(500).json({
          success: false,
          error: `Internal server error - ${message}`,
        });
        logger.error("Internal server error", {message})
      }
    }
  }
}