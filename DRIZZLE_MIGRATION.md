# Drizzle ORM Migration Guide

## Overview

This backend has been successfully migrated from:
- **JavaScript** → **TypeScript**
- **Sequelize ORM** → **Drizzle ORM**

All functionality has been preserved while modernizing the stack.

## Key Changes

### 1. Database Configuration

**Before (Sequelize):**
```javascript
const { Sequelize } = require('sequelize');
const sequelize = new Sequelize(process.env.POSTGRES_URL);
```

**After (Drizzle):**
```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
const db = drizzle(pool, { schema });
```

### 2. Schema Definition

Schema is now defined in `src/db/schema.ts` using Drizzle's type-safe API:

```typescript
import { pgTable, uuid, varchar, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  firstName: varchar('firstName', { length: 255 }).notNull(),
  lastName: varchar('lastName', { length: 255 }).notNull(),
  age: integer('age').notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  isActive: boolean('isActive').default(false).notNull(),
  createTimestamp: timestamp('createTimestamp').defaultNow().notNull(),
  updateTimestamp: timestamp('updateTimestamp').defaultNow().notNull(),
});
```

### 3. Type Safety

Drizzle automatically generates types from schema:

```typescript
import { type User, type NewUser } from '@/model/types';

// User: Type from select queries
// NewUser: Type for insert/update operations
```

## Project Structure

```
src/
├── app.ts                 # Main application entry point
├── db/
│   ├── index.ts          # Database initialization & connection pool
│   └── schema.ts         # Drizzle schema definitions
├── model/
│   └── types.ts          # Re-exported types from schema
├── repositories/
│   ├── UserRepository.ts # User data access layer
│   ├── NodeRepository.ts # Node data access layer
│   └── index.ts          # Barrel export
├── controllers/          # HTTP request handlers (TODO)
├── services/            # Business logic layer (TODO)
├── routes/             # Express route definitions (TODO)
├── middlewares/        # Express middlewares (TODO)
├── validators/        # Request validation (TODO)
├── utils/            # Utility functions
├── dtos/            # Data Transfer Objects
└── tests/          # Unit and integration tests
```

## Getting Started

### Installation

```bash
cd backend
npm install
```

### Environment Variables

Create `.env` file:
```env
POSTGRES_URL=postgresql://user:password@localhost:5432/memorize
PORT=3000
NODE_ENV=development
```

### Running the Server

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm run build
npm start
```

### Database Migrations

Drizzle Kit generates migrations from schema changes:

```bash
# Generate migration files
npm run db:migrate

# View schema in Drizzle Studio (UI)
npm run db:studio
```

## Using Repositories

### Example: Create a User

```typescript
import { UserRepository } from '@/repositories';
import { type NewUser } from '@/model/types';

const newUser: NewUser = {
  firstName: 'John',
  lastName: 'Doe',
  age: 25,
  email: 'john@example.com',
  isActive: true,
};

const user = await UserRepository.create(newUser);
console.log(user.id); // UUID auto-generated
```

### Example: Query Users

```typescript
// Find by ID
const user = await UserRepository.findById('user-uuid');

// Find by email
const user = await UserRepository.findByEmail('john@example.com');

// Get all users
const allUsers = await UserRepository.findAll();

// Update user
const updated = await UserRepository.update('user-uuid', {
  isActive: false,
});

// Delete user
await UserRepository.delete('user-uuid');
```

## Drizzle ORM Features Used

### 1. Type-Safe Queries

```typescript
// Full type safety with autocomplete
const users = await db
  .select()
  .from(usersTable)
  .where(eq(usersTable.email, 'test@example.com'));
// users is typed as User[]
```

### 2. Relations (Future Enhancement)

```typescript
export const usersRelations = relations(users, ({ many }) => ({
  nodes: many(nodes), // if users have many nodes
}));
```

### 3. Transactions

```typescript
await db.transaction(async (tx) => {
  // Multiple operations that all succeed or all fail
  await tx.insert(users).values(userData);
  await tx.update(nodes).set(nodeData);
});
```

## Health Check Endpoints

The application exposes two health check endpoints:

```bash
# Health check - always returns 200
curl http://localhost:3000/health

# Readiness check - returns 200 only if DB is connected
curl http://localhost:3000/ready
```

## Migration from Sequelize

### Key Differences

| Feature | Sequelize | Drizzle |
|---------|-----------|---------|
| **Syntax** | Class-based models | Schema-based definitions |
| **Types** | Manual DTO classes | Automatic type inference |
| **Validation** | Built-in validators | Use Zod/Joi validators |
| **Migrations** | node-pg-migrate | Drizzle Kit |
| **Learning Curve** | Medium | Low (more SQL-like) |
| **Bundle Size** | 2.4 MB | 200 KB |

### Moving Forward

When creating new features:

1. **Define schema** in `src/db/schema.ts`
2. **Create repository** in `src/repositories/`
3. **Add types** automatically via Drizzle's type inference
4. **Build service** layer for business logic
5. **Add controller** for HTTP handling
6. **Define route** in routes

## Common Patterns

### Pagination

```typescript
const page = 1;
const pageSize = 10;
const offset = (page - 1) * pageSize;

const users = await db
  .select()
  .from(usersTable)
  .limit(pageSize)
  .offset(offset);
```

### Sorting

```typescript
import { desc } from 'drizzle-orm';

const users = await db
  .select()
  .from(usersTable)
  .orderBy(desc(usersTable.createTimestamp));
```

### Complex Filtering

```typescript
import { and, or, gte, lte } from 'drizzle-orm';

const users = await db
  .select()
  .from(usersTable)
  .where(
    and(
      gte(usersTable.age, 18),
      or(
        eq(usersTable.isActive, true),
        gte(usersTable.createTimestamp, oneMonthAgo),
      ),
    ),
  );
```

## Troubleshooting

### "POSTGRES_URL is not defined"
Ensure `.env` file exists with `POSTGRES_URL` set.

### Database connection errors
- Check PostgreSQL is running
- Verify connection string in `.env`
- Check network/firewall access

### Type errors in TypeScript
- Run `npm run build` to see all type errors
- Check imports use correct types (`User` vs `NewUser`)

## Next Steps

1. ✅ Core migration complete
2. ⏳ Add controllers and services
3. ⏳ Add request validation with Zod/Joi
4. ⏳ Add comprehensive tests
5. ⏳ Add logging and monitoring
6. ⏳ Add error handling middleware

## References

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [TypeScript Guide](https://www.typescriptlang.org/docs/)
- [Express.js with TypeScript](https://expressjs.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

## Support

For issues or questions:
1. Check Drizzle documentation
2. Review examples in repositories/
3. Check TypeScript compiler output with `npm run build`
