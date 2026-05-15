# Backend

This backend includes Sequelize models and a small Express server.

Development

1. Copy `.env.example` to `.env` and update `POSTGRES_URL`.

2. Install dependencies and run dev server:

```powershell
cd backend
npm ci
npm run dev
```

Production

- Build and run with Docker:

```bash
cd backend
docker build -t memorize-backend:latest .
docker-compose up -d --build
```

- Or run with PM2 on the host:

```bash
cd backend
npm ci --only=production
pm2 start ecosystem.config.js --env production
pm2 save
```

Health checks

- `/health` — liveness
- `/ready` — readiness (checks DB connectivity)
