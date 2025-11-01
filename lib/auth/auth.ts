import { betterAuth } from "better-auth";
import { drizzle } from "drizzle-orm/libsql";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createClient } from "@libsql/client";
import * as schema from "../db/schema";

// Create Turso client
const tursoClient = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Create Drizzle instance with Turso client and schema
const db = drizzle(tursoClient, { schema });

// Create Better Auth Drizzle adapter
const adapter = drizzleAdapter(db, {
  provider: "sqlite",
  schema,
});

export const auth = betterAuth({
  database: adapter,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  secret: process.env.BETTER_AUTH_SECRET || "default-secret-change-in-production",
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:3001", 
    "https://loan-tracker.fly.dev"
  ],
});

export type Session = typeof auth.$Infer.Session;
