/**
 * Unit tests for AuthService
 */

import { AuthService } from '@/services/AuthService';
import { UserService } from '@/services/UserService';

// Mock UserService
jest.mock('@/services/UserService');
// Mock password utilities used by AuthService to avoid bcrypt timing in unit tests
jest.mock('@/utils/password', () => ({
  hashPassword: jest.fn().mockResolvedValue('$2b$12$mockhash'),
  verifyPassword: jest.fn().mockResolvedValue(true),
}));

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('signup', () => {
    it('should create user and return token', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: '$2b$12$hash',
        displayName: 'John Doe',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (UserService.getUserByEmail as jest.Mock).mockResolvedValue(null);
      (UserService.createUser as jest.Mock).mockResolvedValue(mockUser);

      const result = await AuthService.signup(
        'test@example.com',
        'SecurePass123!',
        'John Doe'
      );

      expect(result.token).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should reject duplicate email', async () => {
      const existingUser = {
        id: 'user-456',
        email: 'test@example.com',
        passwordHash: '$2b$12$hash',
        displayName: 'Jane Smith',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (UserService.getUserByEmail as jest.Mock).mockResolvedValue(existingUser);

      await expect(
        AuthService.signup(
          'test@example.com',
          'SecurePass123!',
          'John Doe'
        )
      ).rejects.toThrow('already exists');
    });

    it('should hash password before storing', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: '$2b$12$hash',
        displayName: 'John Doe',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (UserService.getUserByEmail as jest.Mock).mockResolvedValue(null);
      (UserService.createUser as jest.Mock).mockResolvedValue(mockUser);

      await AuthService.signup(
        'test@example.com',
        'SecurePass123!',
        'John Doe'
      );

      // Verify UserService.createUser was called with hashed password
      expect(UserService.createUser).toHaveBeenCalled();
      const createCall = (UserService.createUser as jest.Mock).mock.calls[0][0];
      expect(createCall.passwordHash).not.toBe('SecurePass123!');
      expect(createCall.passwordHash.startsWith('$2b$')).toBe(true);
    });

    it('should generate valid JWT token', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: '$2b$12$hash',
        displayName: 'John Doe',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (UserService.getUserByEmail as jest.Mock).mockResolvedValue(null);
      (UserService.createUser as jest.Mock).mockResolvedValue(mockUser);

      const result = await AuthService.signup(
        'test@example.com',
        'SecurePass123!',
        'John Doe'
      );

      // Token should be a valid JWT (3 parts separated by dots)
      const parts = result.token.split('.');
      expect(parts.length).toBe(3);
    });
  });

  describe('login', () => {
    it('should return token for valid credentials', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: '$2b$12$salt$hash', // bcryptjs hash
        displayName: 'John Doe',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (UserService.getUserByEmail as jest.Mock).mockResolvedValue(mockUser);

      const result = await AuthService.login('test@example.com', 'SecurePass123!');

      expect(result.token).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should reject non-existent user', async () => {
      (UserService.getUserByEmail as jest.Mock).mockResolvedValue(null);

      await expect(
        AuthService.login('nonexistent@example.com', 'SomePass123!')
      ).rejects.toThrow('Invalid credentials');
    });

    it('should not leak whether email exists', async () => {
      (UserService.getUserByEmail as jest.Mock).mockResolvedValue(null);

      const error = 'Invalid credentials';

      try {
        await AuthService.login('nonexistent@example.com', 'SomePass123!');
      } catch (e: any) {
        expect(e.message).toBe(error);
        expect(e.message).not.toContain('not found');
        expect(e.message).not.toContain('not exist');
      }
    });

    it('should sanitize user response (no password)', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: '$2b$12$hash',
        displayName: 'John Doe',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (UserService.getUserByEmail as jest.Mock).mockResolvedValue(mockUser);

      const result = await AuthService.login('test@example.com', 'SomePass123!');

      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user.email).toBe('test@example.com');
    });
  });
});
