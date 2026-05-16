/**
 * Unit tests for password utility functions
 */

import { hashPassword, verifyPassword } from '@/utils/password';

describe('Password Utilities', () => {
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.startsWith('$2b$')).toBe(true); // bcryptjs format
    });

    it('should create different hashes for the same password (salt)', async () => {
      const password = 'TestPassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2); // Different hashes due to unique salts
    });

    it('should handle long passwords', async () => {
      const longPassword = 'A'.repeat(72) + 'B1!'; // Bcrypt max is 72 chars
      const hash = await hashPassword(longPassword);

      expect(hash).toBeDefined();
      expect(hash.startsWith('$2b$')).toBe(true);
    });

    it('should hash empty password (edge case)', async () => {
      const hash = await hashPassword('');
      expect(hash).toBeDefined();
      expect(hash.startsWith('$2b$')).toBe(true);
    });

    it('should reject null/undefined password', async () => {
      // @ts-ignore - testing edge case
      await expect(hashPassword(null)).rejects.toThrow();
      // @ts-ignore - testing edge case
      await expect(hashPassword(undefined)).rejects.toThrow();
    });
  });

  describe('verifyPassword', () => {
    let hashedPassword: string;
    const plainPassword = 'TestPassword123!';

    beforeAll(async () => {
      hashedPassword = await hashPassword(plainPassword);
    });

    it('should verify correct password', async () => {
      const isValid = await verifyPassword(plainPassword, hashedPassword);
      expect(isValid).toBe(true);
    });

    it('should reject wrong password', async () => {
      const isValid = await verifyPassword('WrongPassword123!', hashedPassword);
      expect(isValid).toBe(false);
    });

    it('should be case-sensitive', async () => {
      const isValid = await verifyPassword(plainPassword.toLowerCase(), hashedPassword);
      expect(isValid).toBe(false);
    });

    it('should reject empty password', async () => {
      const isValid = await verifyPassword('', hashedPassword);
      expect(isValid).toBe(false);
    });

    it('should handle invalid hash format gracefully', async () => {
      const isValid = await verifyPassword(plainPassword, 'not-a-valid-hash');
      expect(isValid).toBe(false);
    });

    it('should use constant-time comparison (timing attack resistance)', async () => {
      // This test checks that the comparison doesn't vary significantly based on where the first difference is
      const wrongPassword1 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaWrongPassword123!';
      const wrongPassword2 = 'WrongPassword123!aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

      const start1 = Date.now();
      await verifyPassword(wrongPassword1, hashedPassword);
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      await verifyPassword(wrongPassword2, hashedPassword);
      const time2 = Date.now() - start2;

      // Bcryptjs.compare is constant-time, so both should take similar time
      // (allowing for some variance due to system load)
      const timeDifference = Math.abs(time1 - time2);
      expect(timeDifference).toBeLessThan(100); // Allow up to 100ms variance on CI
    });
  });
});
