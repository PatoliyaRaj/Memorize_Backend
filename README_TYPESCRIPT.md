# Memorize Backend API

Modern Node.js backend built with **Express**, **TypeScript**, **Drizzle ORM**, and **PostgreSQL**.

## Stack

- **Runtime:** Node.js
- **Language:** TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **Validation:** (TBD - Zod/Joi)
- **Testing:** (TBD - Jest)

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your database URL
```

### Running

**Development (with hot-reload):**
```bash
npm run dev
```

**Production:**
```bash
npm run build
npm start
```

### Database

**Generate migrations from schema:**
```bash
npm run db:migrate
```

**Open Drizzle Studio UI:**
```bash
npm run db:studio
```

## Project Structure

```
src/
├── app.ts                 # Express app setup
├── db/                    # Database layer
│   ├── index.ts          # Connection & initialization
│   └── schema.ts         # Drizzle schema definitions
├── model/                 # Type definitions
├── repositories/          # Data access layer
├── controllers/          # HTTP handlers
├── services/            # Business logic
├── routes/             # Route definitions
├── middlewares/        # Express middlewares
├── validators/        # Request validation
├── utils/            # Helper functions
├── dtos/            # Data Transfer Objects
└── tests/          # Test suites
```

## API Health

- `GET /health` - Server health (always 200)
- `GET /ready` - Database readiness check (200 if connected)

## Development

### Scripts

```bash
npm run dev              # Start dev server with hot reload
npm run build           # Build TypeScript to dist/
npm start              # Start production server
npm run db:migrate     # Generate database migrations
npm run db:studio      # Open Drizzle Studio (UI)
npm test              # Run tests
```

### TypeScript

Strict mode enabled by default. Run type checking:
```bash
npm run build  # Will show type errors
```

### Database Examples

See [DRIZZLE_MIGRATION.md](./DRIZZLE_MIGRATION.md) for:
- Schema definitions
- Repository patterns
- Query examples
- Transactions & relations

## Environment Variables

Required:
- `POSTGRES_URL` - PostgreSQL connection string

Optional:
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)

## Deployment

### Docker

```bash
docker build -t memorize-backend .
docker run -e POSTGRES_URL=... -p 3000:3000 memorize-backend
```

### PM2

```bash
npm run start:prod
```

Configured in `ecosystem.config.js`

## Testing

(To be implemented)

```bash
npm test
```

## Contributing

1. Create a new branch
2. Make changes in TypeScript
3. Run `npm run build` to verify
4. Commit and push
5. Create PR

## Troubleshooting

### Port already in use
```bash
# Use different port
PORT=3001 npm run dev
```

### Database connection failed
- Check `POSTGRES_URL` in `.env`
- Ensure PostgreSQL is running
- Verify network connectivity

### Type errors
```bash
npm run build  # See full error list
```

## Documentation

- [Drizzle ORM Migration Guide](./DRIZZLE_MIGRATION.md)
- [Database Structure](./src/STRUCTURE.md)
- [Deployment Guide](./DEPLOYMENT.md)

## License

ISC
