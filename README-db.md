Hybrid Postgres + Supabase setup
-------------------------------

This file documents the recommended production-ready approach for a hybrid local Postgres and Supabase connection for the `backend` service.

Key recommendations
- Use environment-driven selection: connect to local Postgres during development and to Supabase (the managed Postgres) in production.
- Use a connection pool and sensible pool sizes. In production consider PgBouncer or a managed pooler when using serverless functions.
- Use the Supabase DB connection URL (`SUPABASE_DB_URL`) and the `service_role` key server-side for elevated operations; never expose the `service_role` key to clients.
- Use migrations (eg. `node-pg-migrate`) and run them as part of deploy pipeline.
- For TLS/SSL to Supabase, ensure `ssl: { rejectUnauthorized: true }` or follow your cloud provider guidance.

Suggested env variables (see `.env.example`)
- `DB_STRATEGY` — `local` | `supabase` | `fallback` (try local then supabase)
- `POSTGRES_URL` — local Postgres connection string
- `SUPABASE_DB_URL` — Supabase Postgres connection string (for direct PG access)
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_KEY` — Supabase JS client keys
- `PG_POOL_MAX`, `PG_IDLE_TIMEOUT_MILLIS`, `PG_CONNECTION_TIMEOUT_MILLIS` for pooling tuning

Operational notes
- Health checks: add a lightweight endpoint that runs a small `SELECT 1` against the DB.
- Retries: implement exponential backoff for transient connection failures.
- Secrets: store service keys in a secrets manager (Vault, AWS Secrets Manager, Azure Key Vault) in production.

Migration example
- Add `node-pg-migrate` and create migration scripts in `migrations/`.
- Add an npm script: `"migrate": "node-pg-migrate up"` and run during CI deploy.

Further reading
- Postgres pooling and PgBouncer best practices
- Supabase production recommendations (replicas, backups, connection strings)
