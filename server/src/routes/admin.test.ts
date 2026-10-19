import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = "test-secret-key-12345678901234567890123456789012";
process.env["JWT_SECRET"] = JWT_SECRET;

const mockQuery = jest.fn();
jest.mock("../db", () => ({
  __esModule: true,
  default: {
    query: (...args: any[]) => mockQuery(...args),
    connect: jest.fn(),
  },
}));

jest.mock("../services/stellar", () => ({
  resolveDispute: jest.fn(),
}));

jest.mock("../services/fraudDetection", () => ({
  FraudDetectionService: {
    getFlaggedAccounts: jest.fn(),
  },
}));

import adminRouter from "./admin";

const app = express();
app.use(express.json());
app.use("/api/v1/admin", adminRouter);

describe("GET /api/v1/admin/users/:phone", () => {
  const adminId = "99999999-9999-9999-9999-999999999999";
  const adminToken = jwt.sign(
    { sub: adminId, role: "admin", tokenVersion: 1 },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("normalises phone parameter and returns maskedPhone and phoneHash instead of raw phone", async () => {
    // 1st query: authenticate token_version check
    mockQuery.mockResolvedValueOnce({ rows: [{ token_version: 1 }] });
    // 2nd query: authorize role check
    mockQuery.mockResolvedValueOnce({ rows: [{ role: "admin" }] });
    // 3rd query: SELECT user WHERE phone = $1
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "user-123",
          phone: "+2348012345678",
          role: "user",
          created_at: "2026-01-01T00:00:00.000Z",
          stellar_public_key: null,
          balance: 5000,
        },
      ],
    });
    // 4th query: SELECT trade_offers
    mockQuery.mockResolvedValueOnce({ rows: [] });

    // Request with unnormalized local phone number
    const res = await request(app)
      .get("/api/v1/admin/users/08012345678")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    // User query was called with normalized E.164 phone number (+2348012345678)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("WHERE u.phone = $1"),
      ["+2348012345678"]
    );

    // Response contains maskedPhone and phoneHash, not raw phone
    expect(res.body.data.maskedPhone).toBe("+234 *** *** 5678");
    expect(res.body.data.phoneHash).toBeDefined();
    expect(res.body.data.phoneHash.length).toBe(8);
    expect(res.body.data.phone).toBeUndefined();
  });
});
