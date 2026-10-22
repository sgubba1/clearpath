import { existsSync } from "node:fs";
import { createDb } from "../src/db";
import { seedDatabase } from "../src/db/seed";

async function main() {
  if (existsSync(".env")) process.loadEnvFile(".env");

  // Seeds through DIRECT_URL (session pooler) when set, otherwise the app's DATABASE_URL.
  const db = createDb(process.env.DIRECT_URL ?? process.env.DATABASE_URL);
  const started = Date.now();
  const result = await seedDatabase(db);
  console.log(`Seeded ${result.submissions} submissions in ${((Date.now() - started) / 1000).toFixed(1)}s.`);
  await db.$client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
