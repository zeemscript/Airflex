-- Migration 010: Add supporting indexes for the GET /api/v1/admin/users query
-- (issue #256).
--
-- The original query used correlated subqueries that fired one sub-select per
-- user row — O(n) against `transactions` and `trade_offers`. The refactored
-- query in admin.ts uses grouped LEFT JOINs instead, which the planner can
-- satisfy with a single sequential scan of each table aggregated once.
--
-- The indexes below allow those aggregation scans to use index-only or
-- index range scans rather than full table scans, keeping the query well
-- under 500 ms at 10 000 users / 100 000 transactions.
--
-- All statements are idempotent (IF NOT EXISTS).

-- ---------------------------------------------------------------------------
-- 1. transactions(user_id)
--    Used by the tx_agg grouped subquery: GROUP BY user_id, SUM(amount).
--    migration 009 added this table but did not add the index for the
--    aggregation path (only idx_transactions_user covers user_id + created_at,
--    which is the per-user history index — the planner may still choose a
--    seq scan for the aggregate).  This partial-covering index ensures the
--    GROUP BY user_id path uses an index scan.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_transactions_user_id
    ON transactions (user_id);

-- ---------------------------------------------------------------------------
-- 2. trade_offers(seller_id) and trade_offers(buyer_id)
--    Used by the tr_agg UNION ALL subquery that counts participation.
--    Partial indexes (NOT NULL) shrink the index to rows that actually
--    contribute to the count, which is the common case.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_trade_offers_seller_id
    ON trade_offers (seller_id)
    WHERE seller_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trade_offers_buyer_id
    ON trade_offers (buyer_id)
    WHERE buyer_id IS NOT NULL;
