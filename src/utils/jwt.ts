import jwt from 'jsonwebtoken';

/**
 * JWT token payload structure
 */
export interface JWTPayload {
  userId: string;
  email?: string;
  iat?: number;
  exp?: number;
}

/**
 * Decoded JWT token (after verification)
 */
export interface DecodedToken extends JWTPayload {
  iat: number;
  exp: number;
}

// Fail fast if JWT_SECRET is not configured
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    'CRITICAL: JWT_SECRET environment variable is not set. Cannot start server without JWT_SECRET for token generation and verification.'
  );
}

const TOKEN_EXPIRY = '7d';

/**
 * Sign a JWT token
 * @param payload Token payload (userId required)
 * @returns Signed JWT string
 * @throws Error if signing fails
 */
export function signToken(payload: JWTPayload): string {
  try {
    return jwt.sign(payload, JWT_SECRET!, {
      expiresIn: TOKEN_EXPIRY,
      algorithm: 'HS256',
    });
  } catch (error) {
    throw new Error(`Failed to sign token: ${error}`);
  }
}

/**
 * Verify a JWT token
 * @param token JWT string from Authorization header
 * @returns DecodedToken if valid
 * @throws jwt.JsonWebTokenError if invalid/expired/malformed
 */
export function verifyToken(token: string): DecodedToken {
  try {
    const decoded = jwt.verify(token, JWT_SECRET!, {
      algorithms: ['HS256'],
    });

    if (typeof decoded === 'string') {
      throw new Error('Invalid token structure');
    }

    return decoded as DecodedToken;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Decode a token WITHOUT verifying signature
 * Use only for extracting claims in error scenarios
 * @param token JWT string
 * @returns Decoded payload or null if malformed
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.decode(token);
    return decoded as JWTPayload | null;
  } catch {
    return null;
  }
}
