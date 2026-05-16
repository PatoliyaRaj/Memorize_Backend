# Authentication Testing Guide

This guide covers the complete test suite for the JWT authentication implementation.

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-run on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm test -- auth-flow.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="signup"
```

## Test Structure

```
src/__tests__/
├── setup.ts                    # Global test configuration
├── unit/
│   ├── password.test.ts       # Password hashing/verification tests
│   ├── jwt.test.ts            # JWT token generation/verification tests
│   └── AuthService.test.ts    # Authentication business logic tests
└── e2e/
    └── auth-flow.test.ts      # End-to-end authentication flow tests
```

## Test Coverage

### Unit Tests

#### `password.test.ts`
Tests the password hashing and verification utilities:
- ✅ Hash password generation
- ✅ Password verification against hashes
- ✅ Unique salt per password (different hashes for same password)
- ✅ Long password handling (up to bcryptjs max of 72 chars)
- ✅ Case sensitivity
- ✅ Timing-attack resistance (constant-time comparison)

**Run**: `npm test -- password.test.ts`

#### `jwt.test.ts`
Tests the JWT token generation and verification:
- ✅ Token signing with HS256
- ✅ Token payload verification
- ✅ Token expiry (7 days)
- ✅ Token structure (header.payload.signature)
- ✅ Token verification
- ✅ Rejection of tampered tokens
- ✅ Rejection of expired tokens
- ✅ Token decoding without verification
- ✅ Proper error handling

**Run**: `npm test -- jwt.test.ts`

#### `AuthService.test.ts`
Tests the authentication business logic (requires database):
- ✅ User signup with password hashing
- ✅ Duplicate email rejection
- ✅ Token generation on signup
- ✅ User login with password verification
- ✅ Non-existent user rejection (no email enumeration)
- ✅ Inactive account rejection
- ✅ Password sanitization (no password in response)
- ✅ Error messages don't leak information

**Run**: `npm test -- AuthService.test.ts`

### E2E Tests

#### `auth-flow.test.ts`
Tests the complete authentication flow with the Express app:

**Signup Tests**:
- ✅ Create user with valid data
- ✅ Reject duplicate email (409)
- ✅ Reject weak passwords (< 8 chars)
- ✅ Reject password without uppercase
- ✅ Reject password without lowercase
- ✅ Reject password without number
- ✅ Reject password without special character
- ✅ Reject invalid email
- ✅ Reject missing fields

**Login Tests**:
- ✅ Login with correct credentials
- ✅ Reject wrong password (401)
- ✅ Reject non-existent email (401, no enumeration)
- ✅ Reject missing credentials

**Protected Routes Tests**:
- ✅ Require Bearer token for PATCH /users/:id
- ✅ Require Bearer token for DELETE /users/:id
- ✅ Update user profile with valid token
- ✅ Prevent cross-user updates (ownership check)
- ✅ Prevent cross-user deletion
- ✅ Reject invalid token format
- ✅ Reject malformed tokens

**Public Routes Tests**:
- ✅ GET /api/users without auth
- ✅ GET /api/users/:id without auth
- ✅ Responses don't include password hashes

**Run**: `npm test -- auth-flow.test.ts`

## Test Coverage Metrics

Target coverage thresholds:
```
Statements   : 70% min
Branches     : 70% min
Functions    : 70% min
Lines        : 70% min
```

View coverage report:
```bash
npm run test:coverage
```

## Setting Up Test Database

Tests use an in-memory or test database. Configure in `.env.test`:

```bash
NODE_ENV=test
JWT_SECRET=test-jwt-secret-for-testing-only
DB_STRATEGY=local
POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/memorize_test
PORT=5001
```

**One-time setup**:
```bash
# Create test database (optional, in-memory is used by default)
createdb memorize_test

# Run migrations on test DB (if needed)
npm run db:migrate
```

## Key Testing Principles

### 1. **Isolation**
- Tests are isolated and can run in any order
- Database state is cleaned up or mocked
- No shared state between tests

### 2. **Security Testing**
- Password hashing is verified (bcryptjs 12 rounds)
- Tokens are properly signed and verified
- Cross-user access is prevented
- Error messages don't leak information
- Timing attacks are mitigated

### 3. **Rate Limiting in Tests**
- Rate limiting is automatically skipped when `NODE_ENV=test`
- This allows tests to make many requests quickly
- Production rate limiting is not affected

### 4. **Error Scenarios**
- Invalid input validation
- Missing authentication headers
- Expired/invalid tokens
- Cross-user operations
- Database errors (mocked)

## Common Test Patterns

### Testing Password Hashing
```typescript
const hash = await hashPassword('PlainPassword123!');
expect(hash.startsWith('$2b$')).toBe(true); // bcryptjs format
expect(hash).not.toBe('PlainPassword123!');
```

### Testing JWT Tokens
```typescript
const token = signToken({ userId: 'test-123' });
const decoded = verifyToken(token);
expect(decoded.userId).toBe('test-123');
```

### Testing Protected Routes
```typescript
const res = await request(app)
  .patch('/api/users/test-123')
  .set('Authorization', `Bearer ${token}`)
  .send({ firstName: 'Updated' })
  .expect(200);
```

### Testing Error Scenarios
```typescript
const res = await request(app)
  .post('/api/auth/login')
  .send({ email: 'wrong@example.com', password: 'wrong' })
  .expect(401);

expect(res.body.error).toContain('Invalid credentials');
```

## Debugging Tests

### Run Single Test File
```bash
npm test -- password.test.ts
```

### Run Tests Matching Pattern
```bash
npm test -- --testNamePattern="should hash password"
```

### Show Detailed Output
```bash
npm test -- --verbose
```

### Debug with Node Inspector
```bash
node --inspect-brk ./node_modules/.bin/jest --runInBand
```

Then open `chrome://inspect` in Chrome.

## CI/CD Integration

Tests automatically run on:
1. Pre-commit (via Husky if configured)
2. Pull requests (GitHub Actions)
3. Before merge to main

Minimum requirements:
- ✅ All tests pass
- ✅ No console errors
- ✅ 70%+ coverage on critical files

## Next Steps

### Add These Tests Later:
1. **Refresh Token Tests** - When refresh token flow is added
2. **Password Reset Tests** - When forgot-password endpoint is added
3. **Rate Limiting Tests** - When rate limiting behavior needs testing
4. **Logout/Token Revocation Tests** - When logout endpoint is added
5. **2FA Tests** - If two-factor authentication is added
6. **Session Tests** - If persistent sessions are added

### Performance Tests:
```bash
# Measure password hashing performance
npm test -- password.test.ts --detectOpenHandles

# Profile token generation
npm test -- jwt.test.ts --forceExit
```

## Troubleshooting

### "Cannot find module '@/...'"
- Ensure `jest.config.js` has `moduleNameMapper` configured
- Rebuild Jest cache: `npm test -- --clearCache`

### "Port already in use"
- Change test port in `.env.test` or `jest.config.js`
- Kill existing process: `lsof -i :5001` then `kill -9 <PID>`

### "Database connection failed"
- Check test database exists or is configured
- Verify PostgreSQL is running
- Check connection string in `.env.test`

### "Timeout errors in tests"
- Increase `testTimeout` in `jest.config.js`
- Check for unresolved promises
- Verify database queries complete

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Supertest Guide](https://github.com/visionmedia/supertest)
- [bcryptjs Documentation](https://github.com/dcodeIO/bcrypt.js)
- [JWT Best Practices](https://tools.ietf.org/html/rfc7519)
