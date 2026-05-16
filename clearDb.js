const postgres = require('postgres');
const sql = postgres('postgresql://postgres:Raj$11229988@aws-1-ap-south-1.pooler.supabase.com:6543/postgres');

async function main() {
  await sql`DROP SCHEMA IF EXISTS public CASCADE`;
  await sql`CREATE SCHEMA public`;
  console.log('Schema cleared!');
  await sql.end();
}
main();
