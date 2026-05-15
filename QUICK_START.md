# ⚡ Quick Start - Drizzle ORM TypeScript Backend

## 5-Minute Setup

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Database
```bash
# Create .env file
cp .env.example .env

# Edit .env and add your PostgreSQL URL:
# POSTGRES_URL=postgresql://user:password@localhost:5432/memorize
```

### 3. Start Development Server
```bash
npm run dev
```

Expected output:
```
✅ Database initialized successfully
🚀 Server listening on port 3000
```

### 4. Verify It Works
```bash
# In another terminal:

# Health check (should return 200)
curl http://localhost:3000/health

# Database readiness (should return 200 if DB connected)
curl http://localhost:3000/ready

# Get all users (should return empty array initially)
curl http://localhost:3000/api/users
```

## Create Your First User

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Alice",
    "lastName": "Smith",
    "age": 28,
    "email": "alice@example.com",
    "isActive": true
  }'
```

Response:
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "firstName": "Alice",
    "lastName": "Smith",
    "age": 28,
    "email": "alice@example.com",
    "isActive": true,
    "createTimestamp": "2024-05-15T10:30:00.000Z",
    "updateTimestamp": "2024-05-15T10:30:00.000Z"
  }
}
```

## Common Commands

```bash
# Development (with hot reload)
npm run dev

# Build TypeScript
npm run build

# Start production server (requires build first)
npm start

# Generate database migration from schema
npm run db:migrate

# Open Drizzle Studio (interactive database UI)
npm run db:studio

# Run tests (when configured)
npm test
```

## Project Files Overview

| File | Purpose |
|------|---------|
| `src/app.ts` | Express server setup |
| `src/db/schema.ts` | Database schema definitions |
| `src/db/index.ts` | Database connection & initialization |
| `src/repositories/UserRepository.ts` | User database operations |
| `src/repositories/NodeRepository.ts` | Node database operations |
| `src/services/UserService.ts` | User business logic |
| `src/controllers/UserController.ts` | User HTTP handlers |
| `src/routes/users.ts` | User API routes |
| `tsconfig.json` | TypeScript configuration |
| `drizzle.config.ts` | Drizzle ORM configuration |
| `package.json` | Dependencies & scripts |

## API Endpoints

### Users
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create new user
- `PATCH /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Health
- `GET /health` - Server health (always 200)
- `GET /ready` - Database readiness check

## Troubleshooting

### Issue: "POSTGRES_URL is not defined"
**Solution:** Add `POSTGRES_URL` to `.env` file

### Issue: "Cannot connect to PostgreSQL"
**Solution:** 
- Verify PostgreSQL is running
- Check connection string in `.env`
- Verify firewall/network access

### Issue: Port 3000 already in use
**Solution:**
```bash
PORT=3001 npm run dev
```

### Issue: TypeScript compilation errors
**Solution:**
```bash
npm run build  # See full error list
```

## What's Different from Original

| Feature | Old (Sequelize) | New (Drizzle) |
|---------|-----------------|---------------|
| **Language** | JavaScript | TypeScript |
| **ORM** | Sequelize | Drizzle ORM |
| **Running** | `node app.js` | `npm run dev` |
| **Type Checking** | None | Strict |
| **API** | Class-based models | Schema-based |

## Next Steps

1. ✅ Server running
2. ✅ Database connected
3. ⏳ Add Node endpoints (copy User pattern)
4. ⏳ Add validation (Zod/Joi)
5. ⏳ Add authentication
6. ⏳ Add tests

## Useful Links

- [Full Migration Guide](./DRIZZLE_MIGRATION.md)
- [What Was Changed](./MIGRATION_COMPLETE.md)
- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [TypeScript Docs](https://www.typescriptlang.org/)

---

**Happy coding! 🚀**

The modern, type-safe backend is ready for development.
