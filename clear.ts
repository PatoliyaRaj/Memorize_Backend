import postgres from 'postgres';
const sql = postgres('postgresql://postgres:Raj$119966@localhost:5432/memorize');

async function clear() {
  await sql`DROP SCHEMA public CASCADE`;
  await sql`CREATE SCHEMA public`;
  console.log('Cleared!');
  await sql.end();
}
clear().catch(console.error);
