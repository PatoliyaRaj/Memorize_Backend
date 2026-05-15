import 'dotenv/config';
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schemas',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    connectionString: process.env.POSTGRES_URL! || '',
  },
  verbose: true,
  strict: true,
} satisfies Config;
