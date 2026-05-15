Production deployment notes

- Use the Dockerfile to build a production image:

```bash
cd backend
docker build -t memorize-backend:latest .
```

- Use `docker-compose` for local production-like environment (includes Postgres):

```bash
cd backend
docker-compose up -d --build
```

- PM2: install globally on the host and run:

```bash
# on the server
cd backend
npm ci --only=production
pm2 start ecosystem.config.js --env production
pm2 save
```

- Ensure `POSTGRES_URL` is provided to the environment in production. Example:

```
POSTGRES_URL=postgres://dbuser:password@127.0.0.1:5432/dbname
```

- Health endpoints:
  - `/health` — liveness check
  - `/ready` — readiness check (verifies DB connectivity)

