import bcryptjs from 'bcryptjs';

/**
 * Password utility functions for hashing and verification
 * Uses bcryptjs with 12 rounds for timing-attack resistant hashing
 */

const BCRYPT_ROUNDS = 12;

/**
 * Hash a plain-text password
 * @param password Plain-text password
 * @returns Promise<string> Hashed password
 * @throws Error if hashing fails
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    return await bcryptjs.hash(password, BCRYPT_ROUNDS);
  } catch (error) {
    throw new Error(`Failed to hash password: ${error}`);
  }
}

/**
 * Verify a plain-text password against a hash
 * @param password Plain-text password
 * @param hash Hashed password from database
 * @returns Promise<boolean> True if password matches, false otherwise
 * @throws Error if verification fails
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  try {
    return await bcryptjs.compare(password, hash);
  } catch (error) {
    throw new Error(`Failed to verify password: ${error}`);
  }
}

