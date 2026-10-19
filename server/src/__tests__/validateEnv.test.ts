/**
 * validateEnv.test.ts
 *
 * Verifies that assertEnvValid() throws (and would cause a process.exit(1) in
 * production) when JWT_SECRET is absent or too short (issue #247).
 */

import { validateEnv, assertEnvValid } from "../config/validateEnv";

/** Minimal valid env that satisfies every required variable */
const VALID_ENV: Record<string, string> = {
  JWT_SECRET: "a".repeat(64), // 64 chars — well above the 32-char minimum
  DATABASE_URL: "postgresql://test:test@localhost/test",
  ENCRYPTION_KEY: "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
  STELLAR_SERVER_SECRET: "SAIXYZSSAQUEJO3Z3LUQ4PM3VVDK3DIO55V76ORFO6HH2VULC43AFHZX",
  PLATFORM_TREASURY_USER_ID: "00000000-0000-0000-0000-000000000001",
  PAYSTACK_SECRET_KEY: "sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  TERMII_API_KEY: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
};

describe("validateEnv — JWT_SECRET (issue #247)", () => {
  it("passes with a sufficiently long JWT_SECRET", () => {
    const result = validateEnv(VALID_ENV);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when JWT_SECRET is absent", () => {
    const env = { ...VALID_ENV };
    delete env["JWT_SECRET"];

    const result = validateEnv(env);
    expect(result.valid).toBe(false);
    expect(result.missingRequired).toContain("JWT_SECRET");
  });

  it("fails when JWT_SECRET is shorter than 32 characters", () => {
    const result = validateEnv({ ...VALID_ENV, JWT_SECRET: "tooshort" });
    expect(result.valid).toBe(false);
    const hasLengthError = result.errors.some((e) =>
      e.includes("JWT_SECRET is too short")
    );
    expect(hasLengthError).toBe(true);
  });

  it("passes when JWT_SECRET is exactly 32 characters", () => {
    const result = validateEnv({ ...VALID_ENV, JWT_SECRET: "a".repeat(32) });
    expect(result.valid).toBe(true);
  });

  it("assertEnvValid throws when JWT_SECRET is absent", () => {
    const env = { ...VALID_ENV };
    delete env["JWT_SECRET"];
    expect(() => assertEnvValid(env)).toThrow(/JWT_SECRET/);
  });

  it("assertEnvValid throws when JWT_SECRET is too short", () => {
    expect(() =>
      assertEnvValid({ ...VALID_ENV, JWT_SECRET: "weak" })
    ).toThrow(/JWT_SECRET is too short/);
  });
});

describe("validateEnv — ENCRYPTION_KEY format", () => {
  it("fails when ENCRYPTION_KEY is not 64-char hex", () => {
    const result = validateEnv({ ...VALID_ENV, ENCRYPTION_KEY: "not-hex" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("ENCRYPTION_KEY"))).toBe(true);
  });
});
