import { migrate } from "drizzle-orm/libsql/migrator";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as path from "path";

async function runMigration() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    console.log("No TURSO_DATABASE_URL found, skipping migration or using local.db if configured.");
  }

  const client = createClient({
    url: url || "file:local.db",
    authToken: authToken,
  });

  const db = drizzle(client);

  console.log("Running migrations...");

  try {
    await migrate(db, { migrationsFolder: path.join(__dirname, "../drizzle") });
    console.log("✅ Migrations completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:");
    console.error(error);
    process.exit(1);
  } finally {
    client.close();
  }
}

runMigration();
