/*
Safe schema-ensure script.
Adds missing additive columns required by Drizzle schema to the existing database.
Run with: node scripts/ensure-schema.js
*/

const { Pool } = require('pg');
require('dotenv').config();

async function ensure() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  const client = await pool.connect();
  try {
    console.log('Ensuring pgcrypto extension...');
    await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");

    console.log('Ensuring users table exists...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "firstName" varchar(255) NOT NULL,
        "lastName" varchar(255) NOT NULL,
        age integer NOT NULL,
        email varchar(255) NOT NULL UNIQUE,
        "isActive" boolean NOT NULL DEFAULT false,
        password text NOT NULL,
        "createTimestamp" timestamp with time zone NOT NULL DEFAULT now(),
        "updateTimestamp" timestamp with time zone NOT NULL DEFAULT now()
      );
    `);

    await client.query(`ALTER TABLE public.users ALTER COLUMN id SET DEFAULT gen_random_uuid();`);
    await client.query(`ALTER TABLE public.users ALTER COLUMN "createTimestamp" SET DEFAULT now();`);
    await client.query(`ALTER TABLE public.users ALTER COLUMN "updateTimestamp" SET DEFAULT now();`);
    await client.query(`ALTER TABLE public.users ALTER COLUMN "isActive" SET DEFAULT false;`);

    console.log('Adding missing columns to users (safe, additive)...');
    await client.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "firstName" varchar(255);`);
    await client.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "lastName" varchar(255);`);
    await client.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "age" integer;`);
    await client.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "email" varchar(255);`);
    await client.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "isActive" boolean DEFAULT false;`);
    await client.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "password" text;`);
    await client.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "createTimestamp" timestamp with time zone DEFAULT now();`);
    await client.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "updateTimestamp" timestamp with time zone DEFAULT now();`);

    console.log('Ensuring email unique index...');
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS email_idx ON public.users (email);`);

    console.log('Ensuring nodes table exists and columns...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.nodes (
        "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        title varchar(255),
        content text,
        "Links" text[] DEFAULT ARRAY[]::text[],
        "ImageUrl" varchar(500),
        "createTimestamp" timestamp with time zone DEFAULT now(),
        "updateTimestamp" timestamp with time zone DEFAULT now()
      );
    `);

    await client.query(`ALTER TABLE public.nodes ALTER COLUMN "Id" SET DEFAULT gen_random_uuid();`);
    await client.query(`ALTER TABLE public.nodes ALTER COLUMN "createTimestamp" SET DEFAULT now();`);
    await client.query(`ALTER TABLE public.nodes ALTER COLUMN "updateTimestamp" SET DEFAULT now();`);

    console.log('Schema ensure completed');
  } catch (err) {
    console.error('Schema ensure failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

ensure();
