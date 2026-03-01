-- =============================================================
-- CLOVER INTEGRATION COLUMNS
-- =============================================================
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS clover_merchant_id TEXT,
  ADD COLUMN IF NOT EXISTS clover_access_token TEXT,
  ADD COLUMN IF NOT EXISTS clover_last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS menu_sync_source TEXT DEFAULT 'manual';
