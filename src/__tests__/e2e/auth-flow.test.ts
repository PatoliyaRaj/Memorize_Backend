/**
 * E2E tests for authentication flow
 * Tests signup → login → protected routes
 */

import request from 'supertest';
import app from '@/app';

describe('Auth Flow E2E Tests', () => {
  const testUser = {
    email: `test+${Date.now()}@example.com`,
    password: 'SecurePass123!',
    displayName: 'John Doe',
  };

  let token: string;
  let userId: string;

  describe('POST /api/auth/signup', () => {
    it('should create a new user with valid data', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send(testUser);

      // Accept 200 or 201 depending on implementation
      expect([200, 201]).toContain(res.status);

      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(testUser.email);
      expect(res.body.user.displayName).toBe(testUser.displayName);
      expect(res.body.user).not.toHaveProperty('passwordHash'); // Password should not be returned

      token = res.body.token;
      userId = res.body.user.id;
    });

    it('should reject duplicate email', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send(testUser)
        .expect(409);

      expect(res.body.error).toContain('already registered');
    });

    it('should reject weak password (< 8 chars)', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          ...testUser,
          email: 'weak@example.com',
          password: 'Short1!',
        })
        .expect(400);

      expect(res.body.error).toContain('at least 8 characters');
    });

    it('should reject password without uppercase', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          ...testUser,
          email: 'noupper@example.com',
          password: 'nouppercase123!',
        })
        .expect(400);

      expect(res.body.error).toContain('uppercase');
    });

    it('should reject password without lowercase', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          ...testUser,
          email: 'nolower@example.com',
          password: 'NOLOWERCASE123!',
        })
        .expect(400);

      expect(res.body.error).toContain('lowercase');
    });

    it('should reject password without number', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          ...testUser,
          email: 'nonumber@example.com',
          password: 'NoNumbers!',
        })
        .expect(400);

      expect(res.body.error).toContain('number');
    });

    it('should reject password without special character', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          ...testUser,
          email: 'nospecial@example.com',
          password: 'NoSpecial123',
        })
        .expect(400);

      expect(res.body.error).toContain('special character');
    });

    it('should reject invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          ...testUser,
          email: 'invalid-email',
        })
        .expect(400);

      expect(res.body.error).toContain('email');
    });

    it('should reject missing required fields', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          // Missing email
          password: 'SecurePass123!',
        })
        .expect(400);

      expect(res.body.error).toBeDefined();
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(testUser.email);
      expect(res.body.user).not.toHaveProperty('passwordHash');

      // Token should be valid
      expect(res.body.token.split('.').length).toBe(3); // JWT has 3 parts: header.payload.signature
    });

    it('should reject wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(res.body.error).toContain('Invalid credentials');
    });

    it('should reject non-existent email (no email enumeration)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SecurePass123!',
        })
        .expect(401);

      expect(res.body.error).toContain('Invalid credentials');
      // Should NOT say "User not found" - that would leak email existence
    });

    it('should reject missing credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          // Missing password
        })
        .expect(400);

      expect(res.body.error).toBeDefined();
    });
  });

  describe('PATCH /api/users/:id (protected)', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .patch(`/api/users/${userId}`)
        .send({ displayName: 'Updated' })
        .expect(401);

      expect(res.body.error).toContain('authorization');
    });

    it('should reject invalid token format', async () => {
      const res = await request(app)
        .patch(`/api/users/${userId}`)
        .set('Authorization', 'InvalidBearerFormat')
        .send({ displayName: 'Updated' })
        .expect(401);

      expect(res.body.error).toContain('authorization header format');
    });

    it('should reject malformed token', async () => {
      const res = await request(app)
        .patch(`/api/users/${userId}`)
        .set('Authorization', 'Bearer invalid.token.here')
        .send({ displayName: 'Updated' })
        .expect(401);

      expect(res.body.error).toContain('Invalid token');
    });

    it('should update user profile with valid token', async () => {
      const res = await request(app)
        .patch(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ displayName: 'Jane' })
        .expect(200);

      expect(res.body.data.displayName).toBe('Jane');
      expect(res.body.data.email).toBe(testUser.email);
    });

    it('should prevent cross-user updates (ownership check)', async () => {
      // Create another user
      const otherUser = {
        email: `other+${Date.now()}@example.com`,
        password: 'OtherPass123!',
        displayName: 'Other User',
      };

      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send(otherUser);

      const otherToken = signupRes.body.token;
      const _otherUserId = signupRes.body.user.id;

      // Try to update first user with second user's token
      const _res = await request(app)
        .patch(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ displayName: 'Hacker' })
        .expect(403);
      expect(_res.body.error).toContain('only update your own profile');
    });
  });

  describe('DELETE /api/users/:id (protected)', () => {
    let userToDelete: string;
    let deleteToken: string;

    beforeAll(async () => {
      // Create a user specifically for deletion test
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: `delete-me+${Date.now()}@example.com`,
          password: 'DeletePass123!',
          displayName: 'Delete Me',
        });

      deleteToken = res.body.token;
      userToDelete = res.body.user.id;
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .delete(`/api/users/${userToDelete}`)
        .expect(401);

      expect(res.body.error).toContain('authorization');
    });

    it('should prevent cross-user deletion', async () => {
      // Try to delete user with another user's token
      const res = await request(app)
        .delete(`/api/users/${userToDelete}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(res.body.error).toContain('only delete your own account');
    });

    it('should delete user account with valid token', async () => {
      const res = await request(app)
        .delete(`/api/users/${userToDelete}`)
        .set('Authorization', `Bearer ${deleteToken}`)
        .expect(204);

      // Verify user is deleted
      const getRes = await request(app)
        .get(`/api/users/${userToDelete}`)
        .expect(404);
    });
  });

  describe('GET /api/users (public)', () => {
    it('should list all users without authentication', async () => {
      const res = await request(app)
        .get('/api/users')
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('count');
      expect(Array.isArray(res.body.data)).toBe(true);
      // Users should not include password hashes
      res.body.data.forEach((user: any) => {
        expect(user).not.toHaveProperty('passwordHash');
      });
    });
  });

  describe('GET /api/users/:id (public)', () => {
    it('should get user by ID without authentication', async () => {
      const res = await request(app)
        .get(`/api/users/${userId}`)
        .expect(200);

      expect(res.body.data.email).toBe(testUser.email);
      expect(res.body.data).not.toHaveProperty('passwordHash');
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(app)
        .get('/api/users/nonexistent-id')
        .expect(404);

      expect(res.body.error).toContain('not found');
    });
  });
});
