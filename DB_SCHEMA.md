# Backend DB Schema — Structure & Usage

What I changed
- Split the single `schema.ts` into focused files under `src/db/schemas/`: `users.ts`, `nodes.ts`, and an `index.ts` re-export.
- Kept `src/db/schema.ts` as a compatibility re-export so existing imports continue to work.

Files created
- `src/db/schemas/users.ts` — Drizzle `users` table, relations, and TypeScript types.
- `src/db/schemas/nodes.ts` — Drizzle `nodes` table, relations, and TypeScript types.
- `src/db/schemas/index.ts` — Central re-export for easy imports.

Why this structure
- Single-responsibility: each table/schema lives in its own file.
- Easier testing and maintenance: smaller files, explicit types per model.
- Re-exports simplify imports across the codebase.

How to use (quick)
- Import specific tables or types:

  import { users, type User } from '../db/schemas';

- Use the exported `User` / `Node` types where helpful in repositories and services.

Migration notes
- The project currently contains Sequelize models under `src/model/`.
- I did not remove or change Sequelize models to avoid breaking runtime behavior; instead I added Drizzle schema files so you can gradually migrate logic to Drizzle (queries, repositories, migrations).
- The repo does not currently include generated Drizzle migration files under `drizzle/`, so the tables will not appear in Supabase until you generate and apply the initial migration against the Supabase connection.

Suggested next steps
- Replace repository-level raw queries or Sequelize usage with Drizzle queries referencing `users`/`nodes`.
- Add typed repository wrappers that accept the Drizzle tables and return the typed models (`User`, `NewUser`).
- Add migrations or scripts that ensure the DB schema matches Drizzle definitions (if you choose to move fully to Drizzle).
