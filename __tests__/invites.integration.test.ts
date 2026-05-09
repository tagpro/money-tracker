
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { inviteCodes } from "../lib/db/schema/app";
import { user } from "../lib/db/schema/auth";
import { auth } from "../lib/auth/auth";
import { NextRequest } from "next/server";
import * as path from "path";
import * as fs from "fs";

// 1. Define the test DB
const TEST_DB = "invites-integration-test.db";
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

// 4. Import the routes
import { GET as verifyGET } from "../app/api/invites/verify/route";
import { POST as usePOST } from "../app/api/invites/use/route";
import { POST as invitePOST, GET as inviteGET } from "../app/api/invites/route";

describe("Invites Integration Tests", () => {
  beforeAll(async () => {
    await migrate(testDb, { migrationsFolder: path.join(__dirname, "../drizzle") });
  });

  afterAll(async () => {
    testClient.close();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await testClient.execute("DELETE FROM user");
    await testClient.execute("DELETE FROM invite_codes");
  });

  describe("First User Bypass (Chicken & Egg)", () => {
    it("should allow verification without code if no users exist", async () => {
      const req = new NextRequest("http://localhost/api/invites/verify");
      const res = await verifyGET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.valid).toBe(true);
      expect(data.isFirstUser).toBe(true);
    });

    it("should NOT allow verification without code if users exist", async () => {
      // Seed one user
      await testDb.insert(user).values({
        id: "admin-1",
        name: "Admin",
        email: "admin@example.com",
      });

      const req = new NextRequest("http://localhost/api/invites/verify");
      const res = await verifyGET(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.valid).toBe(false);
      expect(data.error).toBe("No invite code provided");
    });
  });

  describe("Invite Code Life Cycle", () => {
    it("should allow an admin to create an invite", async () => {
      // 1. Register first user (admin)
      await testDb.insert(user).values({
        id: "admin-1",
        name: "Admin",
        email: "admin@example.com",
      });

      // Mock session for admin
      (auth.api.getSession as jest.Mock).mockResolvedValue({
        user: { id: "admin-1", email: "admin@example.com" },
      });

      // 2. Create invite
      const inviteReq = new NextRequest("http://localhost/api/invites", {
        method: "POST",
        body: JSON.stringify({ email: "guest@example.com" })
      });
      const inviteRes = await invitePOST(inviteReq);
      const inviteData = await inviteRes.json();

      expect(inviteRes.status).toBe(201);
      expect(inviteData.code).toBeDefined();

      // 3. Verify invite
      const verifyReq = new NextRequest(`http://localhost/api/invites/verify?code=${inviteData.code}`);
      const verifyRes = await verifyGET(verifyReq);
      const verifyData = await verifyRes.json();

      expect(verifyRes.status).toBe(200);
      expect(verifyData.valid).toBe(true);
      expect(verifyData.email).toBe("guest@example.com");

      // 4. Use invite
      const useReq = new NextRequest("http://localhost/api/invites/use", {
        method: "POST",
        body: JSON.stringify({ code: inviteData.code, email: "guest@example.com" })
      });
      const useRes = await usePOST(useReq);
      expect(useRes.status).toBe(200);

      // 5. Verify it is now invalid (used)
      const verifyAgainRes = await verifyGET(verifyReq);
      const verifyAgainData = await verifyAgainRes.json();
      expect(verifyAgainData.valid).toBe(false);
      expect(verifyAgainData.error).toBe("Invite code already used");
    });

    it("should prevent non-admins from creating invites", async () => {
      // Seed two users (so first user logic doesn't trigger)
      await testDb.insert(user).values([
        { id: "admin", name: "Admin", email: "admin@example.com" },
        { id: "user", name: "User", email: "user@example.com" }
      ]);

      // Mock session for regular user
      (auth.api.getSession as jest.Mock).mockResolvedValue({
        user: { id: "user", email: "user@example.com" },
      });

      const req = new NextRequest("http://localhost/api/invites", {
        method: "POST",
        body: JSON.stringify({ email: "other@example.com" })
      });
      const res = await invitePOST(req);
      
      expect(res.status).toBe(403);
    });
  });
});
