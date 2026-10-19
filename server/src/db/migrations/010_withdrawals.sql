-- Migration 010: withdrawals table and supporting indexes (issue #246).
--
-- The withdrawal route previously called the Paystack Transfer API inline and
-- returned 200 on the HTTP response. This migration introduces a proper
-- `withdrawals` table that decouples the HTTP request from the Paystack API
-- call. The route now:
--   1. Validates the request and checks the fiat balance.
--   2. Inserts a withdrawal record in `pending` state.
--   3. Deducts the amount from `wallets.fiat_balance` atomically.
--   4. Enqueues a `process-withdrawal` background job.
--   5. Returns 202 Accepted with the withdrawal id.
--
-- The `process-withdrawal` job processor calls Paystack and moves the record
-- to `processing`. The Paystack `transfer.success` / `transfer.failed` webhook
-- then sets the final state to `completed` or `failed`, optionally crediting
-- the fiat_balance back on failure.

-- ---------------------------------------------------------------------------
-- withdrawals table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS withdrawals (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Naira amount requested by the user
    amount              NUMERIC(18,2) NOT NULL CHECK (amount > 0),

    -- Destination bank details (snapshot at request time)
    bank_code           VARCHAR(10)   NOT NULL,
    account_number      VARCHAR(20)   NOT NULL,
    account_name        VARCHAR(255)  NOT NULL,

    -- Paystack identifiers populated by the background processor
    paystack_recipient_code TEXT,
    paystack_transfer_code  TEXT,

    -- Unique idempotency reference we generate; stored on the Paystack transfer
    reference           TEXT          NOT NULL UNIQUE
                            DEFAULT ('airflex-wd-' || gen_random_uuid()::text),

    -- State machine:
    --   pending    → job has been enqueued, no Paystack call yet
    --   processing → Paystack transfer initiated (transfer_code obtained)
    --   completed  → transfer.success webhook received
    --   failed     → transfer.failed / permanent processor failure
    status              VARCHAR(16)   NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

    failure_reason      TEXT,

    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user
    ON withdrawals (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_withdrawals_status
    ON withdrawals (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_withdrawals_reference
    ON withdrawals (reference);

-- ---------------------------------------------------------------------------
-- Trigger: keep withdrawals.updated_at current on every UPDATE
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_withdrawal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_withdrawals_updated_at ON withdrawals;
CREATE TRIGGER trg_withdrawals_updated_at
    BEFORE UPDATE ON withdrawals
    FOR EACH ROW EXECUTE FUNCTION set_withdrawal_updated_at();
