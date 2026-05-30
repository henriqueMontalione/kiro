-- Required for ON CONFLICT in the webhook upsert path. The webhook fires
-- every time an Etherfuse order changes status, so we need a stable key to
-- collapse repeat events into a single transactions row.
--
-- Partial index because pre-Etherfuse rows (if any) and any non-ramp
-- movements we add later may legitimately have NULL etherfuse_order_id.
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_etherfuse_order_id
    ON transactions(etherfuse_order_id)
    WHERE etherfuse_order_id IS NOT NULL;
