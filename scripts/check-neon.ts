import { neon } from '@neondatabase/serverless';

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL!;
  const sql = neon(DATABASE_URL);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows = await sql`
    SELECT COUNT(*) as count FROM "Response"
    WHERE "createdAt" >= ${today.toISOString()}
  `;

  const count = parseInt(rows[0].count as string);
  if (count === 0) {
    console.log(JSON.stringify({ newResponses: false }));
  } else {
    console.log(JSON.stringify({ newResponses: true, count }));
  }
}

main().catch(console.error);
