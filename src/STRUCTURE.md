Recommended `src` folder structure for production-ready backend

- `controllers/` — HTTP request handlers, call services, return responses
- `routes/` — Express route definitions, mount controllers
- `validators/` — Request validation schemas (Joi/Zod) and middleware
- `services/` — Business logic, orchestrate repositories and external APIs
- `repositories/` — DB access layer (Sequelize calls), encapsulate queries
- `middlewares/` — Express middlewares (auth, error handling, logging)
- `utils/` — Utility helpers and small pure functions
- `dtos/` — Data Transfer Objects or serializers
- `jobs/` — Background job handlers (cron, queues)
- `tests/` — Unit and integration tests

Guidelines

- Keep controllers thin; put heavy logic in services.
- Repositories should only interact with the ORM and return plain objects.
- Validators should be middleware used in routes before controllers.
- Add index files to aggregate exports for cleaner imports.
- Use environment variables for secrets and connection strings; do NOT commit `.env`.
