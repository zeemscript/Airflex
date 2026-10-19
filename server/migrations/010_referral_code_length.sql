-- #263: referral codes are now 16 base32 characters (80 bits of entropy).
-- Widen the column so new codes fit; existing 8-character codes stay valid.
ALTER TABLE users ALTER COLUMN referral_code TYPE VARCHAR(16);

-- 001_referrals.sql declares the column UNIQUE. Re-assert it here so the
-- guarantee holds even on databases where the column predates that migration.
CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_unique ON users (referral_code);
