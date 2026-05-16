import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '@/utils/jwt';

/**
 * Extended Express Request with authenticated user
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
      };
    }
  }
}

/**
 * Authentication middleware
 * Verifies JWT Bearer token and attaches user to request
 * Usage: router.patch('/:id', authMiddleware, handler)
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    // Extract Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        success: false,
        error: 'Missing authorization header',
      });
      return;
    }

    // Parse "Bearer <token>"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      res.status(401).json({
        success: false,
        error: 'Invalid authorization header format. Expected "Bearer <token>"',
      });
      return;
    }

    const token = parts[1];

    // Verify token
    const decoded = verifyToken(token);

    // Attach user to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
    };

    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (
      message === 'Token expired' ||
      message === 'Invalid token' ||
      message === 'Invalid token structure'
    ) {
      res.status(401).json({
        success: false,
        error: message,
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }
  }
}

/**
 * Optional auth middleware
 * Like authMiddleware but doesn't fail if token is missing
 * Usage: router.get('/:id', optionalAuthMiddleware, handler)
 */
export function optionalAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      // Token not provided, continue without user
      return next();
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      // Malformed header, continue without user (don't fail)
      return next();
    }

    const token = parts[1];
    const decoded = verifyToken(token);

    req.user = {
      id: decoded.userId,
      email: decoded.email,
    };

    next();
  } catch {
    // Token invalid or expired, continue without user (don't fail)
    next();
  }
}
