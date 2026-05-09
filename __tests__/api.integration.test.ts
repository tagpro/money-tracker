
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { transactions, interestRates } from "../lib/db/schema/app";
import { user } from "../lib/db/schema/auth";
import { auth } from "../lib/auth/auth";
import { NextRequest } from "next/server";
import * as path from "path";
import * as fs from "fs";

// 1. Define the test DB
const TEST_DB = "api-integration-test.db";
if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
const testClient = createClient({ url: `file:${TEST_DB}` });
const testDb = drizzle(testClient);

// 2. Mock lib/db BEFORE importing routes
jest.mock("../lib/db", () => ({
  db: testDb,
  rawClient: testClient
}));

// 3. Mock Better Auth session
jest.mock("../lib/auth/auth", () => ({
  auth: {
    api: {
      getSession: jest.fn()
    }
  }
}));

// 4. Now import the routes
import { POST as accruePOST, GET as accrueGET } from "../app/api/accrue-interest/route";
import { POST as transPOST } from "../app/api/transactions/route";
import { GET as exportGET } from "../app/api/export/route";

describe("API Integration Tests", () => {
  beforeAll(async () => {
    // Run migrations to setup schema programmatically
    await migrate(testDb, { migrationsFolder: path.join(__dirname, "../drizzle") });

    // Bootstrap foundational data (Seed)
    await testDb.insert(user).values({
      id: "test-user",
      name: "Test User",
      email: "test@example.com",
    });

    await testDb.insert(interestRates).values({
      rate: 5.0,
      effectiveDate: "2024-01-01",
    });
  });

  afterAll(async () => {
    testClient.close();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    // Default to authorized
    (auth.api.getSession as jest.Mock).mockResolvedValue({
      user: { id: "test-user", email: "test@example.com" },
      session: { id: "test-session" }
    });
    
    // Clear transactions before each test to ensure isolation
    await testClient.execute("DELETE FROM transactions");
  });

  describe("POST /api/transactions", () => {
    it("should create a new transaction", async () => {
      const payload = {
        type: "deposit",
        amount: 1000,
        date: "2024-01-15",
        description: "Initial Test Deposit"
      };

      const req = new NextRequest("http://localhost/api/transactions", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      const res = await transPOST(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.amount).toBe(1000);
      expect(data.id).toBeDefined();
    });
  });

  describe("POST /api/accrue-interest", () => {
    it("should accrue interest and be idempotent", async () => {
      // Seed a deposit from the past
      await testDb.insert(transactions).values({
        type: "deposit",
        amount: 10000,
        date: "2024-01-01",
        description: "Seed Deposit"
      });

      // 1. Accrue first time
      const req1 = new NextRequest("http://localhost/api/accrue-interest", {
        method: "POST"
      });
      const res1 = await accruePOST(req1);
      const data1 = await res1.json();

      expect(res1.status).toBe(200);
      expect(data1.interestTransactionsAdded).toBeGreaterThan(0);
      
      // 2. Accrue second time (idempotency check)
      const req2 = new NextRequest("http://localhost/api/accrue-interest", {
        method: "POST"
      });
      const res2 = await accruePOST(req2);
      const data2 = await res2.json();

      expect(res2.status).toBe(200);
      expect(data2.interestTransactionsAdded).toBe(0);
      expect(data2.message).toContain("Added 0");
    });

    it("should return 401 if unauthorized", async () => {
      (auth.api.getSession as jest.Mock).mockResolvedValue(null);

      const req = new NextRequest("http://localhost/api/accrue-interest", {
        method: "POST"
      });
      const res = await accruePOST(req);
      
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/accrue-interest (Verification)", () => {
    it("should report discrepancies before accrual and none after", async () => {
      // Seed deposit
      await testDb.insert(transactions).values({
        type: "deposit",
        amount: 10000,
        date: "2024-01-01",
      });

      // Check discrepancies (should have some)
      const res1 = await accrueGET();
      const data1 = await res1.json();
      expect(data1.allCorrect).toBe(false);
      expect(data1.discrepancies.length).toBeGreaterThan(0);

      // Accrue
      await accruePOST(new NextRequest("http://localhost/api/accrue-interest", { method: "POST" }));

      // Check again (should be clean)
      const res2 = await accrueGET();
      const data2 = await res2.json();
      expect(data2.allCorrect).toBe(true);
      expect(data2.discrepancies.length).toBe(0);
    });
  });

  describe("GET /api/export", () => {
    it("should return a CSV and NOT modify the database", async () => {
      // Seed a deposit
      await testDb.insert(transactions).values({
        type: "deposit",
        amount: 5000,
        date: "2024-01-01",
        description: "Export Test Seed"
      });

      // Record count before
      const countBeforeRes = await testClient.execute("SELECT count(*) as count FROM transactions");
      const countBefore = countBeforeRes.rows[0].count;

      const res = await exportGET();
      
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("text/csv");
      
      const csvText = await res.text();
      expect(csvText).toContain("Date,Balance,Daily Interest Rate (%)");
      expect(csvText).toContain("Export Test Seed");

      // Record count after
      const countAfterRes = await testClient.execute("SELECT count(*) as count FROM transactions");
      const countAfter = countAfterRes.rows[0].count;
      
      // ASSERT: No database changes occurred
      expect(countAfter).toBe(countBefore);
      
      // Double check: No interest transactions were added (the previous bug)
      const interestCountRes = await testClient.execute("SELECT count(*) as count FROM transactions WHERE type='interest'");
      expect(interestCountRes.rows[0].count).toBe(0);
    });
  });
});
