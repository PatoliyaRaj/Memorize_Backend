// src/__tests__/e2e/auth-flow.test.ts
import request from 'supertest';
import app from '@/app';

describe('Auth Flow', () => {
  it('should signup, login, and update user profile', async () => {
    // 1. SIGNUP
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({
        email: 'test@example.com',
        password: 'SecureP@ss123',
        firstName: 'John',
        lastName: 'Doe',
        age: 25,
      });

    expect([200, 201]).toContain(signupRes.status);
    expect(signupRes.body.token).toBeDefined();
    expect(signupRes.body.user.email).toBe('test@example.com');
    expect(signupRes.body.user.password).toBeUndefined(); // No password in response!

    const { token, user } = signupRes.body;

    // 2. LOGIN
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'SecureP@ss123',
      })
      .expect(200);

    expect(loginRes.body.token).toBeDefined();
    expect(loginRes.body.user.id).toBe(user.id);

    // 3. UPDATE (protected)
    const updateRes = await request(app)
      .patch(`/api/users/${user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Jane' })
      .expect(200);

    expect(updateRes.body.data.firstName).toBe('Jane');

    // 4. Verify cross-tenant protection
    const otherSignup = await request(app)
      .post('/api/auth/signup')
      .send({
        email: 'other@example.com',
        password: 'SecureP@ss123',
        firstName: 'Other',
        lastName: 'User',
        age: 30,
      });

    const otherToken = otherSignup.body.token;

    // Try to update someone else's profile
    await request(app)
      .patch(`/api/users/${user.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ firstName: 'Hacker' })
      .expect(403); // Forbidden!
  });
});